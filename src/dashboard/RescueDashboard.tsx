import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, FlatList, ListRenderItem, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useListener } from './useListener';
import RadarScreen from './RadarScreen';
import { useAppStore } from '../shared/store';
import { DetectedDevice, getRSSIState, RSSI_COLORS } from '../shared/types';

export default function RescueDashboard() {
  const [selectedDevice, setSelectedDevice] = useState<DetectedDevice | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isScanning, startListening, stopListening, sortedDevices } = useListener();

  useEffect(() => {
    AsyncStorage.getItem('pa_volunteer_onboarded').then(v => {
      if (!v) setShowOnboarding(true);
    });
  }, []);

  const handleOnboardCTA = () => {
    AsyncStorage.setItem('pa_volunteer_onboarded', 'true').then(() => {
      setShowOnboarding(false);
    });
  };

  const scanAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanAnim.setValue(1);
    }
  }, [isScanning, scanAnim]);

  const renderItem: ListRenderItem<DetectedDevice> = ({ item, index }) => {
    const currentState = getRSSIState(item.rssi);
    const currentColor = RSSI_COLORS[currentState];
    const secondsAgo = Math.max(0, Math.round((Date.now() - item.lastSeen) / 1000));

    return (
      <View>
        {index === 0 && sortedDevices.length > 1 ? (
          <View style={styles.nearestPillContainer}>
            <View style={styles.nearestPill}>
              <Text style={styles.nearestPillText}>NEAREST</Text>
            </View>
          </View>
        ) : null}
        
        <TouchableOpacity 
          style={[styles.card, { borderLeftColor: currentColor }]}
          onPress={() => setSelectedDevice(item)}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.userIdText}>{item.packet.userId}</Text>
            {item.packet.medicalTag ? (
              <Text style={styles.medicalTagText}>{item.packet.medicalTag}</Text>
            ) : null}
            <Text style={styles.lastSeenText}>Last seen {secondsAgo}s ago</Text>
          </View>
          
          <View style={styles.cardRight}>
            <View style={styles.rssiRow}>
              <Text style={[styles.rssiValueText, { color: currentColor }]}>{item.rssi}</Text>
              <Text style={[styles.rssiUnitText, { color: currentColor, marginLeft: 2 }]}>dBm</Text>
            </View>
            <Text style={styles.trackText}>TRACK</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow1}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>RESCUE DASHBOARD</Text>
            <Text style={styles.headerSubtitle}>Find & Assist</Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.scanButton, isScanning ? styles.scanButtonActive : styles.scanButtonDefault]} 
            onPress={isScanning ? stopListening : startListening}
          >
            <Text style={isScanning ? styles.scanButtonTextActive : styles.scanButtonTextDefault}>
              {isScanning ? 'STOP' : 'SCAN'}
            </Text>
          </TouchableOpacity>
        </View>

        {isScanning && (
          <View style={styles.headerRow2}>
            <Animated.View style={[styles.scanDot, { opacity: scanAnim }]} />
            <Text style={styles.scanScanningText}>{'  '}SCANNING FOR SOS SIGNALS</Text>
          </View>
        )}
      </View>

      {sortedDevices.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyOuterSquare}>
            <View style={styles.emptyInnerSquare} />
          </View>
          <Text style={styles.emptyTitle}>NO SIGNALS DETECTED</Text>
          <Text style={styles.emptyDesc}>Start scanning to detect{'\n'}SOS broadcasts nearby</Text>
        </View>
      ) : (
        <FlatList
          data={sortedDevices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.bottomBar}>
        <Text style={styles.bottomBarText}>
          {isScanning ? `${sortedDevices.length} signal(s) active` : 'Scanner off'}
        </Text>
      </View>

      {selectedDevice && (
        <View style={styles.radarOverlay}>
          <RadarScreen device={selectedDevice} onBack={() => setSelectedDevice(null)} />
        </View>
      )}

      <Modal animationType="slide" transparent={true} visible={showOnboarding}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalRedRule} />
            <Text style={styles.modalSubtitle}>HOW TO FIND SOMEONE</Text>
            <Text style={styles.modalTitle}>Your rescue guide</Text>

            {[
              { num: '1', title: 'Start Scanning', body: 'Tap SCAN to detect SOS broadcasts nearby' },
              { num: '2', title: 'Select a Signal', body: 'Tap any signal to open the live tracker' },
              { num: '3', title: 'Follow the Color', body: 'Green means close. Walk toward stronger signal.' },
              { num: '4', title: 'Share Medical Info', body: 'Show the medical tag to first responders' },
            ].map(step => (
              <View key={step.num} style={styles.stepRow}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepNumber}>{step.num}</Text>
                </View>
                <View style={styles.stepTextBlock}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.ctaButton} onPress={handleOnboardCTA}>
              <Text style={styles.ctaButtonText}>Got it — Start Helping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  headerRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#666',
  },
  headerSubtitle: {
    fontSize: 22,
    fontWeight: '800',
    color: 'white',
    marginTop: 2,
  },
  scanButton: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonDefault: {
    backgroundColor: '#E8001C',
  },
  scanButtonActive: {
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: 'transparent',
  },
  scanButtonTextDefault: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'white',
  },
  scanButtonTextActive: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#666',
  },
  headerRow2: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E8001C',
  },
  scanScanningText: {
    fontSize: 9,
    letterSpacing: 3,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyOuterSquare: {
    width: 48,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#1C1C1C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyInnerSquare: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  emptyTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#333',
    marginTop: 20,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 100,
  },
  nearestPillContainer: {
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  nearestPill: {
    borderWidth: 1,
    borderColor: '#E8001C',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nearestPillText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#E8001C',
  },
  card: {
    marginBottom: 10,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
  },
  userIdText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
  medicalTagText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  lastSeenText: {
    fontSize: 10,
    color: '#444',
    marginTop: 4,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  rssiRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rssiValueText: {
    fontSize: 22,
    fontWeight: '900',
  },
  rssiUnitText: {
    fontSize: 9,
    opacity: 0.6,
    letterSpacing: 1,
  },
  trackText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#E8001C',
    marginTop: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#111',
    padding: 16,
  },
  bottomBarText: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#666',
    textAlign: 'center',
  },
  radarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 28,
  },
  modalRedRule: {
    width: 32,
    height: 3,
    backgroundColor: '#E8001C',
    borderRadius: 2,
    marginBottom: 20,
  },
  modalSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#999',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0A0A0A',
    marginTop: 4,
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: '#E8001C',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E8001C',
    textAlign: 'center',
  },
  stepTextBlock: {
    marginLeft: 12,
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  stepBody: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: '#0A0A0A',
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  ctaButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 1,
  },
});
