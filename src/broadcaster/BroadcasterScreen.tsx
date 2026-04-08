import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  Animated, 
  StyleSheet,
  NativeModules
} from 'react-native';
import SOSButton from './SOSButton';
import { useBroadcaster } from './useBroadcaster';
import { useAppStore } from '../shared/store';

const BroadcasterScreen = () => {
  const { isAdvertising, startSOS, stopSOS } = useBroadcaster();
  const { userId } = useAppStore();

  const [nameInput, setNameInput] = useState('');
  const [medicalInput, setMedicalInput] = useState('');
  
  const bgAnim = useRef(new Animated.Value(0)).current;
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Background Animation Loop
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    
    if (isAdvertising) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bgAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: false,
          }),
          Animated.timing(bgAnim, {
            toValue: 0,
            duration: 900,
            useNativeDriver: false,
          }),
        ])
      );
      loop.start();
    } else {
      bgAnim.stopAnimation();
      bgAnim.setValue(0);
    }

    return () => {
      if (loop) loop.stop();
    };
  }, [isAdvertising, bgAnim]);

  // Safety Timer and Screen Wake Lock
  useEffect(() => {
    if (isAdvertising) {
      safetyTimerRef.current = setTimeout(() => {
        Alert.alert(
          'Are you still in danger?',
          'Your SOS is still broadcasting.',
          [
            { text: 'Yes, still need help', style: 'cancel' },
            { text: 'I am safe — Cancel SOS', style: 'destructive', onPress: stopSOS }
          ]
        );
      }, 30000);

      try { NativeModules.PowerManager?.acquire?.(); } catch {}
    } else {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      try { NativeModules.PowerManager?.release?.(); } catch {}
    }

    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      // Ensure we release the wake lock on unmount if it was active
      if (isAdvertising) {
        try { NativeModules.PowerManager?.release?.(); } catch {}
      }
    };
  }, [isAdvertising, stopSOS]);

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#0A0A0A', '#1A0000'],
  });

  const handleStartSOS = () => {
    const generatedUserId = nameInput.trim() || 'USR-' + Date.now().toString(36).toUpperCase();
    const medicalData = medicalInput.trim() || undefined;
    startSOS(generatedUserId, medicalData);
  };

  const handleActivate = () => {
    Alert.alert(
      'Activate SOS Broadcast?',
      'Only use in a genuine emergency. This will alert nearby volunteers.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Activate', style: 'destructive', onPress: handleStartSOS }
      ]
    );
  };

  if (isAdvertising) {
    return (
      <Animated.View style={[styles.containerActive, { backgroundColor: bgColor }]}>
        <View style={styles.activeCenter}>
          <SOSButton isActive={true} onPress={() => {}} disabled={true} />
          <Text style={styles.activeTitle}>SOS BROADCAST ACTIVE</Text>
          <View style={styles.divider} />
          <Text style={styles.activeSubtitle}>Rescuers are being guided to you</Text>
          <Text style={styles.userIdText}>{userId}</Text>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={stopSOS} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.topLabel}>EMERGENCY BROADCAST</Text>
      </View>
      
      <View style={styles.middleSection}>
        <SOSButton isActive={false} onPress={handleActivate} />
        <Text style={styles.tapToActivate}>TAP TO ACTIVATE SOS</Text>
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.inputSectionLabel}>YOUR DETAILS</Text>
        <TextInput
          style={styles.input}
          placeholder="Name or ID"
          placeholderTextColor="#444"
          value={nameInput}
          onChangeText={setNameInput}
        />
        <TextInput
          style={[styles.input, styles.inputMargin]}
          placeholder="Medical info (optional)"
          placeholderTextColor="#444"
          value={medicalInput}
          onChangeText={setMedicalInput}
          maxLength={60}
        />
        <Text style={styles.charCount}>{medicalInput.length} / 60</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    padding: 24,
  },
  topSection: {
    paddingTop: 52,
  },
  topLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#666',
  },
  middleSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -24,
  },
  tapToActivate: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#666',
    marginTop: 20,
  },
  inputSection: {
    marginBottom: 32,
  },
  inputSectionLabel: {
    fontSize: 10,
    letterSpacing: 3,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#111',
    color: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  inputMargin: {
    marginTop: 10,
  },
  charCount: {
    fontSize: 11,
    color: '#444',
    textAlign: 'right',
    marginTop: 4,
  },
  
  // Active state styles
  containerActive: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 4,
    color: '#ffffff',
    marginTop: 28,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: '#E8001C',
    marginVertical: 16,
  },
  activeSubtitle: {
    fontSize: 13,
    color: '#888',
    letterSpacing: 1,
  },
  userIdText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    height: 48,
    marginBottom: 40,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    letterSpacing: 3,
    color: '#888',
  },
});

export default BroadcasterScreen;
