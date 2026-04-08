package com.portableanchors

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.ParcelUuid
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.util.UUID

/**
 * BLEForegroundService — runs 24/7 as an Android foreground service.
 *
 * Responsibilities:
 *  1. Show a persistent notification so Android won't kill the process.
 *  2. Scan for BLE devices that advertise our SOS_SERVICE_UUID.
 *  3. When an SOS device is found, relay-advertise its payload so other
 *     nearby devices (outside direct range) can also detect it.
 *
 * This runs entirely in native code so it survives JS bridge suspension.
 */
class BLEForegroundService : Service() {

    companion object {
        private const val TAG = "BLEForegroundSvc"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "ble_mesh_channel"

        // Must match src/shared/bleConstants.ts
        private const val SOS_SERVICE_UUID_STR = "0000AA00-0000-1000-8000-00805F9B34FB"
        private val SOS_SERVICE_UUID: UUID = UUID.fromString(SOS_SERVICE_UUID_STR)

        // Relay: re-advertise for 2 s on each found SOS signal
        private const val RELAY_BURST_MS = 2000L
        // Cooldown: don't relay the same device more often than every 10 s
        private const val RELAY_COOLDOWN_MS = 10_000L
    }

    private var scanner: BluetoothLeScanner? = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private val handler = Handler(Looper.getMainLooper())

    // Track last relay time per device to avoid flooding
    private val lastRelayTime = mutableMapOf<String, Long>()

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Enforce Android 14+ permissions restriction. If we don't have them, startForeground will crash.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val hasScan = ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
            val hasConnect = ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
            if (!hasScan && !hasConnect) {
                Log.e(TAG, "FATAL GUARD: Missing BLUETOOTH_SCAN/CONNECT permissions. Aborting service to prevent Android 14 crash.")
                stopSelf()
                return START_NOT_STICKY
            }
        }

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Safety Mesh Active")
            .setContentText("Scanning for SOS signals near you.")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        startForeground(NOTIFICATION_ID, notification)
        startBleScan()

        // START_STICKY → Android will restart this service if killed (low memory etc.)
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        stopBleScan()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── BLE ───────────────────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    private fun startBleScan() {
        val btManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val btAdapter: BluetoothAdapter = btManager?.adapter ?: run {
            Log.w(TAG, "No Bluetooth adapter — scan skipped")
            return
        }

        if (!btAdapter.isEnabled) {
            Log.w(TAG, "Bluetooth disabled — scan skipped")
            return
        }

        scanner = btAdapter.bluetoothLeScanner ?: run {
            Log.w(TAG, "No BLE scanner available")
            return
        }
        advertiser = btAdapter.bluetoothLeAdvertiser

        // Filter to ONLY our SOS service UUID — no other device will match
        val scanFilter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(SOS_SERVICE_UUID))
            .build()

        val scanSettings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_POWER) // battery-friendly
            .setReportDelay(0)
            .build()

        scanner?.startScan(listOf(scanFilter), scanSettings, scanCallback)
        Log.i(TAG, "BLE scan started for SOS_SERVICE_UUID")
    }

    @SuppressLint("MissingPermission")
    private fun stopBleScan() {
        try {
            scanner?.stopScan(scanCallback)
        } catch (e: Exception) {
            Log.w(TAG, "stopScan error: ${e.message}")
        }
        scanner = null
        advertiser = null
    }

    // ── Scan callback ─────────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val deviceId = result.device.address
            val now = System.currentTimeMillis()

            // Cooldown check — don't relay the same device more often than RELAY_COOLDOWN_MS
            val lastRelay = lastRelayTime[deviceId] ?: 0L
            if (now - lastRelay < RELAY_COOLDOWN_MS) return
            lastRelayTime[deviceId] = now

            // Extract the SOS payload from service data
            val serviceData = result.scanRecord?.getServiceData(ParcelUuid(SOS_SERVICE_UUID))
            val payload = serviceData?.toString(Charsets.UTF_8) ?: "PA1|RELAY"

            Log.i(TAG, "SOS device found: $deviceId payload=$payload RSSI=${result.rssi}")

            // Relay: re-advertise the SOS for RELAY_BURST_MS so devices out of
            // direct range can also detect it
            relayAdvertise(payload)
        }

        override fun onScanFailed(errorCode: Int) {
            Log.w(TAG, "BLE scan failed: errorCode=$errorCode")
        }
    }

    // ── Relay advertising ─────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    private fun relayAdvertise(payload: String) {
        val adv = advertiser ?: return

        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(false)
            .setTimeout(0)
            .build()

        val payloadBytes = payload.toByteArray(Charsets.UTF_8).take(20).toByteArray()

        val data = AdvertiseData.Builder()
            .addServiceUuid(ParcelUuid(SOS_SERVICE_UUID))
            .addServiceData(ParcelUuid(SOS_SERVICE_UUID), payloadBytes)
            .setIncludeDeviceName(false)
            .build()

        val callback = object : AdvertiseCallback() {
            override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                Log.i(TAG, "Relay advertising started")
                // Stop after burst duration
                handler.postDelayed({
                    try { adv.stopAdvertising(this) } catch (e: Exception) { /* silent */ }
                }, RELAY_BURST_MS)
            }

            override fun onStartFailure(errorCode: Int) {
                Log.w(TAG, "Relay advertising failed: errorCode=$errorCode")
            }
        }

        try {
            adv.startAdvertising(settings, data, callback)
        } catch (e: Exception) {
            Log.w(TAG, "startAdvertising exception: ${e.message}")
        }
    }

    // ── Notification channel ──────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Safety Mesh",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Background SOS relay mesh"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
