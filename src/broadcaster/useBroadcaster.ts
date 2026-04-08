import { useState, useEffect, useCallback, useRef } from 'react';
import { Vibration, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../shared/store';

const { BLEAdvertiser } = NativeModules;

export const useBroadcaster = () => {
  const [isAdvertising, setIsAdvertising] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { setRole, setUserId } = useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopSOS = useCallback(async (): Promise<void> => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // FIX #5: Stop actual BLE advertising
      try {
        if (BLEAdvertiser && typeof BLEAdvertiser.stopAdvertising === 'function') {
          await BLEAdvertiser.stopAdvertising();
        }
      } catch (bleErr) {
        console.warn('[BroadcasterHook] stopAdvertising failed (native unavailable):', bleErr);
      }

      const existingStr = await AsyncStorage.getItem('PA_SOS_ACTIVE');
      if (existingStr) {
        const existing = JSON.parse(existingStr);
        await AsyncStorage.setItem(
          'PA_SOS_ACTIVE',
          JSON.stringify({ ...existing, active: false })
        );
      }
    } catch (e: any) {
      console.warn('[BroadcasterHook] Failed to stop SOS fallback:', e);
    } finally {
      setIsAdvertising(false);
      setRole('idle');
    }
  }, [setRole]);

  const startSOS = useCallback(
    async (userId: string, medicalTag?: string): Promise<void> => {
      setError(null);

      try {
        const packet = {
          userId,
          medicalTag: medicalTag ?? '',
          timestamp: Date.now(),
          active: true,
        };

        // Persist to AsyncStorage so listeners on the same device can detect us
        await AsyncStorage.setItem('PA_SOS_ACTIVE', JSON.stringify(packet));

        // FIX #5: Actually start BLE advertising so other physical devices can detect us
        // Device name format: PA-SOS-{userId} — matched by listener name filter
        const advertisingName = `PA-SOS-${userId}`;
        const payloadStr = JSON.stringify({ userId, medicalTag: medicalTag ?? '', timestamp: packet.timestamp });
        try {
          if (BLEAdvertiser && typeof BLEAdvertiser.startAdvertising === 'function') {
            await BLEAdvertiser.startAdvertising(advertisingName, payloadStr);
            console.log('[BroadcasterHook] BLE advertising started:', advertisingName);
          } else {
            console.warn('[BroadcasterHook] BLEAdvertiser native module not available — using AsyncStorage only');
          }
        } catch (bleErr) {
          console.warn('[BroadcasterHook] BLE advertising failed (non-fatal, using AsyncStorage fallback):', bleErr);
        }

        // Heartbeat: keep AsyncStorage timestamp fresh so local listener keeps seeing us
        intervalRef.current = setInterval(async () => {
          try {
            const updatedPacket = { ...packet, timestamp: Date.now() };
            await AsyncStorage.setItem('PA_SOS_ACTIVE', JSON.stringify(updatedPacket));

            // Re-emit BLE advertising pulse every 3s (keeps the SOS alive across restarts)
            try {
              if (BLEAdvertiser && typeof BLEAdvertiser.startAdvertising === 'function') {
                await BLEAdvertiser.startAdvertising(advertisingName, JSON.stringify(updatedPacket));
              }
            } catch { /* silent — already advertised */ }
          } catch (e) {
            console.warn('[BroadcasterHook] Failed to update SOS heartbeat:', e);
          }
        }, 3000);

        setIsAdvertising(true);
        setRole('broadcaster');
        setUserId(userId);
        Vibration.vibrate([0, 200, 100, 200]);
      } catch (e: any) {
        setError(e.message || 'Unknown error occurred while starting SOS');
        setIsAdvertising(false);
      }
    },
    [setRole, setUserId]
  );

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopSOS();
    };
  }, [stopSOS]);

  return {
    isAdvertising,
    error,
    startSOS,
    stopSOS,
  };
};
