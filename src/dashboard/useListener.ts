import { useState, useEffect, useRef, useMemo } from 'react';
import { BleManager, Device } from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppStore } from '../shared/store';
import { DetectedDevice, SOSPacket } from '../shared/types';

export const useListener = () => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const managerRef = useRef<BleManager | null>(null);

  const { detectedDevices, upsertDevice, setRole } = useAppStore();

  const startListening = () => {
    setRole('listener');
    if (!managerRef.current) {
      managerRef.current = new BleManager();
    }
    const manager = managerRef.current;
    setIsScanning(true);

    manager.startDeviceScan(null, { allowDuplicates: true }, (error, device: Device | null) => {
      if (error || !device) return;

      if (!device.name || !device.name.startsWith('PA-SOS')) {
        return;
      }

      const userId = device.name.replace(/^PA-SOS[-_:\s]*/i, '') || device.id;

      const packet: SOSPacket = {
        userId,
        timestamp: Date.now()
      };

      const detected: DetectedDevice = {
        id: device.id,
        rssi: device.rssi ?? -99,
        packet,
        lastSeen: Date.now(),
      };

      upsertDevice(detected);
    });
  };

  const stopListening = () => {
    managerRef.current?.stopDeviceScan();
    setRole('idle');
    setIsScanning(false);
  };

  const sortedDevices = useMemo(() => {
    return [...detectedDevices]
      .filter(d => Boolean(d.packet && d.packet.userId))
      .sort((a, b) => b.rssi - a.rssi);
  }, [detectedDevices]);

  // Check AsyncStorage for local SOS heartbeat
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const existingStr = await AsyncStorage.getItem('PA_SOS_ACTIVE');
        if (existingStr) {
          const existing = JSON.parse(existingStr);
          if (existing && existing.active) {
            upsertDevice({
              id: 'local-sos',
              rssi: -10, // Hot RSSI to stay near top
              packet: {
                userId: existing.userId,
                medicalTag: existing.medicalTag,
                timestamp: existing.timestamp || Date.now()
              },
              lastSeen: Date.now()
            });
          }
        }
      } catch (e) {
        console.warn('Failed to read local SOS heartbeat', e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [upsertDevice]);

  useEffect(() => {
    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isScanning, startListening, stopListening, sortedDevices };
};
