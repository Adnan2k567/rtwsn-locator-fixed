import React, { useState, useEffect } from 'react';
import { View, AppState, AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import SplashScreen from './SplashScreen';
import RootNavigator from './RootNavigator';

// Lazy-load heavy modules so any import errors don't crash launch
let PermissionModal: any = null;
let usePermissions: any = null;
let useForegroundService: any = null;

try {
  const pMod = require('@/permissions/PermissionModal');
  PermissionModal = pMod.default;
  usePermissions = pMod.usePermissions;
} catch (e) {
  console.warn('[App] Failed to load PermissionModal:', e);
}

try {
  const fMod = require('@/permissions/useForegroundService');
  useForegroundService = fMod.useForegroundService;
} catch (e) {
  console.warn('[App] Failed to load useForegroundService:', e);
}

const noop = () => {};
const noopAsync = async () => {};

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [showModal, setShowModal] = useState(true);

  // Safe permission hook — falls back to no-ops if module failed
  const { hasAll = false, requestAll = noop } =
    usePermissions ? usePermissions() : {};

  // Safe foreground service hook — falls back to no-ops
  const { startService = noopAsync } =
    useForegroundService ? useForegroundService() : {};

  // Start native foreground service ONLY when permissions are fully granted.
  // Starting a connectedDevice service without permissions in Android 14+ is a fatal OS crash.
  useEffect(() => {
    const safeStart = async () => {
      if (hasAll) {
        try {
          await startService();
        } catch (e) {
          console.warn('[App] startService error (non-fatal):', e);
        }
      }
    };
    safeStart();
  }, [hasAll]); // <-- Depends on hasAll safely transitioning to true

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        console.log('[App] state →', nextState);
      },
    );
    return () => subscription.remove();
  }, []);

  const handleAcceptPermissions = async () => {
    setShowModal(false);
    try { await requestAll(); } catch {}
  };

  const handleDismissPermissions = () => setShowModal(false);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        {/* Permission modal — shown before splash clears if permissions missing */}
        {PermissionModal && !hasAll && showModal && (
          <PermissionModal
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
    </SafeAreaProvider>
  );
}
