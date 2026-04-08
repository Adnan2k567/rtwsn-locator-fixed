import React, { useState, useEffect } from 'react';
import { View, AppState, AppStateStatus } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import SplashScreen from './SplashScreen';
import RootNavigator from './RootNavigator';

// LOCKED IMPORTS
import PermissionModal, { usePermissions } from '@/permissions/PermissionModal';
import { useForegroundService } from '@/permissions/useForegroundService';
import RelayEngine from '@/relay/RelayEngine';

const FallbackRelayEngine = () => null;
const FallbackPermissionModal = () => null;

const SafeRelayEngine = RelayEngine || FallbackRelayEngine;
const SafePermissionModal = PermissionModal || FallbackPermissionModal;

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [showModal, setShowModal] = useState(true);

  const { hasAll, requestAll } = usePermissions();

  const { startService } = useForegroundService();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      console.log('[App] state → ' + nextState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAcceptPermissions = () => {
    if (requestAll) requestAll();
    if (startService) startService();
    setShowModal(false);
  };

  const handleDismissPermissions = () => {
    setShowModal(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <SafeRelayEngine />
      {(!hasAll && showModal) && (
        <SafePermissionModal
          visible={showModal}
          onAccept={handleAcceptPermissions}
          onDismiss={handleDismissPermissions}
        />
      )}
      {!splashDone ? (
        <SplashScreen onFinish={() => setSplashDone(true)} />
      ) : (
        <NavigationContainer
          theme={{
            ...DarkTheme,
            dark: true,
            colors: {
              ...DarkTheme.colors,
              background: '#0A0A0A',
              card: '#0A0A0A',
              text: '#FFFFFF',
              border: '#1C1C1C',
              notification: '#E8001C',
              primary: '#E8001C',
            },
          }}
        >
          <RootNavigator />
        </NavigationContainer>
      )}
    </View>
  );
}
