import { useState, useEffect, useCallback, useRef } from 'react';
import { Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../shared/store';

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
      
      const existingStr = await AsyncStorage.getItem('PA_SOS_ACTIVE');
      if (existingStr) {
        const existing = JSON.parse(existingStr);
        await AsyncStorage.setItem('PA_SOS_ACTIVE', JSON.stringify({ ...existing, active: false }));
      }
    } catch (e: any) {
      console.warn('Failed to stop SOS fallback', e);
    } finally {
      setIsAdvertising(false);
      setRole('idle');
    }
  }, [setRole]);

  const startSOS = useCallback(async (userId: string, medicalTag?: string): Promise<void> => {
    setError(null);

    try {
      const packet = {
        userId,
        medicalTag: medicalTag ?? '',
        timestamp: Date.now(),
        active: true,
      };

      await AsyncStorage.setItem('PA_SOS_ACTIVE', JSON.stringify(packet));

      intervalRef.current = setInterval(async () => {
        try {
          const updatedPacket = {
            ...packet,
            timestamp: Date.now(),
          };
          await AsyncStorage.setItem('PA_SOS_ACTIVE', JSON.stringify(updatedPacket));
        } catch (e) {
          console.warn('Failed to update SOS heartbeat', e);
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
  }, [setRole, setUserId]);

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
    stopSOS
  };
};
