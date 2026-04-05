import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Vibration } from 'react-native';
import { useAppStore } from '../shared/store';
import { DetectedDevice, getRSSIState, RSSI_COLORS, RSSIState } from '../shared/types';

interface Props {
  device: DetectedDevice;
  onBack: () => void;
}

const SparkLine = ({ data, height, color }: { data: number[], height: number, color: string }) => {
  if (!data.length) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height }}>
      {data.map((v, i) => {
        const barH = Math.max(2, ((v + 100) / 100) * height);
        return <View key={i} style={{ width: 3, height: barH, borderRadius: 1, marginHorizontal: 1, backgroundColor: color }} />;
      })}
    </View>
  );
};

export default function RadarScreen({ device, onBack }: Props) {
  const { detectedDevices } = useAppStore();
  
  // Find the most recent stats from the store based on the navigated device id
  const liveDevice = detectedDevices.find(d => d.id === device.id) || device;
  const liveDeviceRef = useRef(liveDevice);
  
  useEffect(() => {
    liveDeviceRef.current = liveDevice;
  }, [liveDevice]);

  const [rssi, setRssi] = useState<number>(device.rssi);
  const [rssiHistory, setRssiHistory] = useState<number[]>([]);
  const prevStateRef = useRef<RSSIState | null>(null);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.04,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      ])
    ).start();

    // LIVE dot animation (1 -> 0.3 -> 1 over 1000ms)
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [scaleAnim, opacityAnim]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentRssi = liveDeviceRef.current.rssi;
      setRssi(currentRssi);
      
      const st = getRSSIState(currentRssi);
      if (st === 'hot' && prevStateRef.current !== 'hot') {
        Vibration.vibrate([0, 80, 60, 80]);
      }
      prevStateRef.current = st;
      
      setRssiHistory(prev => {
        const next = [...prev, currentRssi];
        return next.length > 20 ? next.slice(next.length - 20) : next;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const currentState: RSSIState = getRSSIState(rssi);
  const currentColor = RSSI_COLORS[currentState];

  const activeCount: number = Math.max(1, Math.min(5, Math.round((rssi + 100) / 12)));
  const bars = [12, 18, 26, 34, 42];

  const stateLabels = {
    hot: 'CLOSE',
    warm: 'WARMING',
    cold: 'SEARCHING'
  };

  const subLabels = {
    hot: 'Keep your current heading',
    warm: 'Move toward stronger signal',
    cold: 'Change direction and scan'
  };

  const secondsAgo = Math.floor((Date.now() - liveDevice.lastSeen) / 1000);

  const prevRssi = rssiHistory.length >= 6 ? rssiHistory[rssiHistory.length - 6] : null;
  const latestRssi = rssiHistory[rssiHistory.length - 1] ?? rssi;
  const diff = prevRssi !== null ? latestRssi - prevRssi : 0;
  const trend = diff > 3 ? 'improving' : diff < -3 ? 'retreating' : 'stable';

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.userNameText} numberOfLines={1}>{liveDevice.packet.userId}</Text>
        <View style={styles.liveIndicator}>
          <Text style={styles.liveText}>LIVE</Text>
          <Animated.View style={[styles.liveDot, { opacity: opacityAnim }]} />
        </View>
      </View>

      <View style={styles.main}>
        <Animated.View style={[styles.circlesWrapper, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.outerCircle, { borderColor: currentColor + '33' }]} />
          <View style={[styles.middleCircle, { borderColor: currentColor + '66' }]} />
          <View style={[styles.innerCircle, { 
            backgroundColor: currentColor + '14', 
            borderColor: currentColor + 'CC' 
          }]}>
            <Text style={[styles.rssiValueText, { color: currentColor }]}>{String(rssi)}</Text>
            <Text style={[styles.rssiUnitText, { color: currentColor }]}>dBm</Text>
          </View>
        </Animated.View>

        <Text style={styles.stateLabelText}>{stateLabels[currentState]}</Text>
        <Text style={styles.subLabelText}>{subLabels[currentState]}</Text>

        <View style={styles.trendRow}>
          <View style={styles.trendIconContainer}>
            {trend === 'stable' ? (
              <View style={{ width: 14, height: 2, backgroundColor: '#FFD600' }} />
            ) : (
              <>
                <View style={{ position: 'absolute', width: 10, height: 2, backgroundColor: trend === 'improving' ? '#00C853' : '#E8001C', transform: [{ rotate: trend === 'improving' ? '-45deg' : '45deg' }, { translateX: -3 }] }} />
                <View style={{ position: 'absolute', width: 10, height: 2, backgroundColor: trend === 'improving' ? '#00C853' : '#E8001C', transform: [{ rotate: trend === 'improving' ? '45deg' : '135deg' }, { translateX: 3 }] }} />
              </>
            )}
          </View>
          <Text style={[
            styles.trendText, 
            { color: trend === 'improving' ? '#00C853' : trend === 'retreating' ? '#E8001C' : '#FFD600' }
          ]}>
            {trend === 'improving' ? 'APPROACHING' : trend === 'retreating' ? 'MOVING AWAY' : 'STABLE'}
          </Text>
        </View>

        <View style={{ marginTop: 12, marginBottom: 4 }}>
          <SparkLine data={rssiHistory} height={32} color={currentColor} />
        </View>

        <View style={styles.barsContainer}>
          {bars.map((height, idx) => {
            const isActive = idx < activeCount;
            return (
              <View 
                key={idx} 
                style={[
                  styles.bar, 
                  { 
                    height, 
                    backgroundColor: isActive ? currentColor : '#222' 
                  }
                ]} 
              />
            );
          })}
        </View>
      </View>

      <View style={styles.bottom}>
        {liveDevice.packet.medicalTag ? (
          <View style={styles.medicalPill}>
            <Text style={styles.medicalPillText}>{liveDevice.packet.medicalTag}</Text>
          </View>
        ) : null}
        <Text style={styles.lastUpdatedText}>
          Last updated {secondsAgo < 0 ? 0 : secondsAgo}s ago
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  topBar: {
    paddingTop: 48,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 18,
    color: 'white',
  },
  userNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveText: {
    fontSize: 9,
    letterSpacing: 3,
    color: '#666',
    marginRight: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00C853',
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circlesWrapper: {
    width: 260,
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerCircle: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1.5,
  },
  middleCircle: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1.5,
  },
  innerCircle: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rssiValueText: {
    fontSize: 36,
    fontWeight: '900',
  },
  rssiUnitText: {
    fontSize: 12,
    opacity: 0.7,
    letterSpacing: 1,
  },
  stateLabelText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 6,
    color: 'white',
    marginTop: 24,
  },
  subLabelText: {
    fontSize: 12,
    color: '#666',
    letterSpacing: 1,
    marginTop: 6,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  trendIconContainer: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendText: {
    marginLeft: 6,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
  barsContainer: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bar: {
    width: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  bottom: {
    padding: 24,
    alignItems: 'center',
  },
  medicalPill: {
    borderWidth: 1,
    borderColor: '#E8001C',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  medicalPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E8001C',
    letterSpacing: 1,
  },
  lastUpdatedText: {
    fontSize: 10,
    color: '#444',
    marginTop: 8,
  },
});
