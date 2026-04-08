package com.portableanchors

import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.os.ParcelUuid
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BLEAdvertiserModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var advertiseCallback: AdvertiseCallback? = null

    override fun getName(): String {
        return "BLEAdvertiser"
    }

    @ReactMethod
    fun startAdvertising(serviceUUID: String, payload: String, promise: Promise) {
        try {
            val bluetoothManager = reactApplicationContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bluetoothManager?.adapter
            val bluetoothLeAdvertiser = adapter?.bluetoothLeAdvertiser

            if (bluetoothLeAdvertiser == null) {
                promise.reject("BLE_UNAVAILABLE", "Not supported")
                return
            }

            val settings = AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(false)
                .setTimeout(0)
                .build()

            val uuid = ParcelUuid.fromString(serviceUUID)
            val payloadBytes = payload.toByteArray(Charsets.UTF_8).take(20).toByteArray()

            val data = AdvertiseData.Builder()
                // Broadcast UUID so scanners can filter quickly. (Compresses to 4 bytes)
                .addServiceUuid(uuid)
                // Broadcast payload via ServiceData. (Header 4 bytes + Payload 20 = 24 bytes)
                // Total packet: 3 (Flags) + 4 + 24 = 31 bytes perfectly.
                .addServiceData(uuid, payloadBytes)
                .setIncludeDeviceName(false)
                .build()

            advertiseCallback = object : AdvertiseCallback() {
                override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                    super.onStartSuccess(settingsInEffect)
                    promise.resolve("advertising")
                }

                override fun onStartFailure(errorCode: Int) {
                    super.onStartFailure(errorCode)
                    promise.reject("ADV_FAIL", errorCode.toString())
                }
            }

            bluetoothLeAdvertiser.startAdvertising(settings, data, advertiseCallback)

        } catch (e: Exception) {
            promise.reject("ERR", e.message)
        }
    }

    @ReactMethod
    fun stopAdvertising(promise: Promise) {
        try {
            val bluetoothManager = reactApplicationContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bluetoothManager?.adapter
            val bluetoothLeAdvertiser = adapter?.bluetoothLeAdvertiser

            advertiseCallback?.let {
                bluetoothLeAdvertiser?.stopAdvertising(it)
            }
            advertiseCallback = null
            promise.resolve("stopped")
        } catch (e: Exception) {
            promise.reject("ERR", e.message)
        }
    }
}

// TODO_MIRAN: register in MainApplication.kt getPackages():
// packages.add(ForegroundServicePackage())
// packages.add(BLEAdvertiserPackage())
