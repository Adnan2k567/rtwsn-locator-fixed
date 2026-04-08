import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BleManager, Device } from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppStore } from '../shared/store';
import { DetectedDevice, SOSPacket } from '../shared/types';

// Stale device threshold: remove devices not seen in 15 seconds
const STALE_THRESHOLD_MS = 15000;

// Name prefix every SOS broadcaster must use
const SOS_NAME_PREFIX = 'PA-SOS';

export const useListener = () => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const managerRef = useRef<BleManager | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pruneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { detectedDevices, upsertDevice, clearDevices, setRole } = useAppStore();

  // Keep a stable ref to upsertDevice to avoid re-subscribing intervals
  const upsertDeviceRef = useRef(upsertDevice);
  useEffect(() => {
    upsertDeviceRef.current = upsertDevice;
  }, [upsertDevice]);

  // Immediate injection of local SOS on scan start (Fix #2)
  const injectLocalSOS = useCallback(async () => {
    try {
      const existingStr = await AsyncStorage.getItem('PA_SOS_ACTIVE');
      if (existingStr) {
        const existing = JSON.parse(existingStr);
        if (existing && existing.active) {
          upsertDeviceRef.current({
            id: 'local-sos',
            rssi: -10,
            packet: {
              userId: existing.userId,
              medicalTag: existing.medicalTag,
              timestamp: existing.timestamp || Date.now(),
            },
            lastSeen: Date.now(),
          });
        }
      }
    } catch (e) {
      console.warn('[useListener] Failed to inject local SOS', e);
    }
  }, []);

  const stopListening = useCallback(() => {
    isScanningRef.current = false;

    // Stop BLE scan
    if (managerRef.current) {
      managerRef.current.stopDeviceScan();
      managerRef.current.destroy();   // <-- FIX #1: release native resources
      managerRef.current = null;
    }

    // Stop heartbeat and prune intervals
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (pruneIntervalRef.current) {
      clearInterval(pruneIntervalRef.current);
      pruneIntervalRef.current = null;
    }

    setRole('idle');
    setIsScanning(false);
  }, [setRole]);

  const startListening = useCallback(async () => {
    if (isScanningRef.current) return; // guard double-start
    setRole('listener');
    isScanningRef.current = true;

    // FIX #4: clear stale device list before a new scan session
    clearDevices();

    // FIX #2: immediately inject local SOS if this device is broadcasting
    await injectLocalSOS();

    // Create a fresh BleManager (destroy any lingering one first)
    if (managerRef.current) {
      managerRef.current.stopDeviceScan();
      managerRef.current.destroy();
    }
    managerRef.current = new BleManager();
    const manager = managerRef.current;

    setIsScanning(true);

    // BLE scan — only accept PA-SOS named devices (Fix #4)
    manager.startDeviceScan(
      null,
      { allowDuplicates: true },
      (error, device: Device | null) => {
        if (error || !device) return;

        // FIX #4: strict name filter — only PA-SOS prefixed names
        const deviceName = device.name ?? '';
        if (!deviceName.startsWith(SOS_NAME_PREFIX)) return;

        const userId = deviceName.replace(/^PA-SOS[-_:\s]*/i, '') || device.id;

        const packet: SOSPacket = {
          userId,
          timestamp: Date.now(),
        };

        const detected: DetectedDevice = {
          id: device.id,
          rssi: device.rssi ?? -99,
          packet,
          lastSeen: Date.now(),
        };

        upsertDeviceRef.current(detected);
      }
    );

    // Heartbeat: re-inject local SOS every 3s while scanning
    heartbeatIntervalRef.current = setInterval(async () => {
      if (!isScanningRef.current) return;
      await injectLocalSOS();
    }, 3000);

    // Prune stale devices every 5s
    pruneIntervalRef.current = setInterval(() => {
      if (!isScanningRef.current) return;
      const now = Date.now();
      const state = useAppStore.getState();
      const fresh = state.detectedDevices.filter(
        (d) => now - d.lastSeen < STALE_THRESHOLD_MS
      );
      if (fresh.length !== state.detectedDevices.length) {
        // Replace entire list with only fresh devices
        state.clearDevices();
        fresh.forEach((d) => state.upsertDevice(d));
      }
    }, 5000);
  }, [setRole, clearDevices, injectLocalSOS]);

  const sortedDevices = useMemo(() => {
    return [...detectedDevices]
      .filter((d) => Boolean(d.packet && d.packet.userId))
      .sort((a, b) => b.rssi - a.rssi);
  }, [detectedDevices]);

  // Cleanup on unmount — FIX #1
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return { isScanning, startListening, stopListening, sortedDevices };
};
