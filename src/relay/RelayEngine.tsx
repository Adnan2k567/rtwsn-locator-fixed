import { useEffect, useRef } from 'react';
import { AppState, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRelay } from './useRelay';
import { useAppStore } from '../shared/store';
import { getCacheSize } from './debounceCache';

const RelayEngine = () => {
  const { startRelaying, stopRelaying, isRelaying } = useRelay();
  const isRelayingRef = useRef(isRelaying);

  useEffect(() => {
    isRelayingRef.current = isRelaying;
  }, [isRelaying]);

  const isServiceRunning = useAppStore((s) => s.isServiceRunning);

  useEffect(() => {
    if (!isServiceRunning) {
      console.warn('[RelayEngine] foreground service stopped', getCacheSize());
    }
  }, [isServiceRunning]);

  useEffect(() => {
    startRelaying();

    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && !isRelayingRef.current) {
        startRelaying();
      }
    });

    return () => {
      sub.remove();
      stopRelaying();
    };
  }, [startRelaying, stopRelaying]);

  return null;
};

export default RelayEngine;

type RelayStatusBadgeProps = { style?: StyleProp<ViewStyle> };

export function RelayStatusBadge({ style }: RelayStatusBadgeProps) {
  const { isRelaying } = useRelay();

  return (
    <View style={[styles.pill, isRelaying ? styles.pillActive : styles.pillInactive, style]}>
      <View style={[styles.dot, isRelaying ? styles.dotActive : styles.dotInactive]} />
      <Text style={[styles.label, isRelaying ? styles.labelActive : styles.labelInactive]}>
        {isRelaying ? 'MESH ACTIVE' : 'MESH INACTIVE'}
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
