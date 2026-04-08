import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRelay } from './useRelay';
import { useAppStore } from '../shared/store';
import { getCacheSize } from './debounceCache';

const RelayEngine = () => {
  const { startRelaying, stopRelaying } = useRelay();

  const role = useAppStore((s) => s.role);
  const setServiceRunning = useAppStore((s) => s.setServiceRunning);

  // Keep stable refs so the main effect never re-fires due to function identity changes
  const startRef = useRef(startRelaying);
  const stopRef = useRef(stopRelaying);
  const setServiceRef = useRef(setServiceRunning);
  useEffect(() => { startRef.current = startRelaying; }, [startRelaying]);
  useEffect(() => { stopRef.current = stopRelaying; }, [stopRelaying]);
  useEffect(() => { setServiceRef.current = setServiceRunning; }, [setServiceRunning]);

  // Start relay on mount, stop on unmount. Runs exactly once.
  useEffect(() => {
    startRef.current();
    setServiceRef.current(true);
    return () => {
      stopRef.current();
      setServiceRef.current(false);
    };
  }, []);

  // When the user is actively scanning in the RESCUE tab (role = 'listener'),
  // temporarily pause the relay's BLE scan to avoid two BleManager instances
  // fighting over the same radio. Resume when scanning stops.
  const pausedRef = useRef(false);
  useEffect(() => {
    if (role === 'listener') {
      if (!pausedRef.current) {
        pausedRef.current = true;
        stopRef.current();
        console.log('[RelayEngine] paused relay scan — user is actively scanning');
      }
    } else {
      if (pausedRef.current) {
        pausedRef.current = false;
        startRef.current();
        console.log('[RelayEngine] resumed relay scan');
      }
    }
  }, [role]);

  return null;
};

export default RelayEngine;

type RelayStatusBadgeProps = { style?: StyleProp<ViewStyle> };

export function RelayStatusBadge({ style }: RelayStatusBadgeProps) {
  const { isRelaying } = useRelay();
  const detectedDevices = useAppStore((s) => s.detectedDevices);

  return (
    <View style={[styles.pill, isRelaying ? styles.pillActive : styles.pillInactive, style]}>
      <View style={[styles.dot, isRelaying ? styles.dotActive : styles.dotInactive]} />
      <Text style={[styles.label, isRelaying ? styles.labelActive : styles.labelInactive]}>
        {isRelaying ? `${detectedDevices.length} devices in mesh` : 'MESH INACTIVE'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: 'rgba(0,200,83,0.1)',
    borderColor: '#00C853',
  },
  pillInactive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: '#333',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#00C853',
  },
  dotInactive: {
    backgroundColor: '#333',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  labelActive: {
    color: '#00C853',
  },
  labelInactive: {
    color: '#444',
  },
});
