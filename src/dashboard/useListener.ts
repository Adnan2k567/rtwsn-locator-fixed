import { useState, useEffect, useRef, useMemo } from 'react';
import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

import { SOS_SERVICE_UUID } from '../shared/bleConstants';
import { useAppStore } from '../shared/store';
import { DetectedDevice, SOSPacket, getRSSIState, RSSI_COLORS } from '../shared/types';

export const useListener = () => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const managerRef = useRef<BleManager | null>(null);

  const { detectedDevices, upsertDevice, clearDevices, setRole } = useAppStore();

  const startListening = () => {
    setRole('listener');
    const manager = new BleManager();
    managerRef.current = manager;
    setIsScanning(true);

    manager.startDeviceScan([SOS_SERVICE_UUID], { allowDuplicates: true }, (error, device: Device | null) => {
      if (error || !device) return;

      let packet: SOSPacket;
      try {
        const raw = device.manufacturerData
          ? Buffer.from(device.manufacturerData, 'base64').toString('utf8')
          : '';
        packet = JSON.parse(raw);
      } catch {
        packet = { userId: device.id, timestamp: Date.now() };
      }

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
    return [...detectedDevices].sort((a, b) => b.rssi - a.rssi);
  }, [detectedDevices]);

  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[Listener] stale cleanup ran');
    }, 5000);

    return () => {
      clearInterval(interval);
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isScanning, startListening, stopListening, sortedDevices };
};
