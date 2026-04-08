import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAppStore } from '../shared/store';
import SOSScreen from '../broadcaster/BroadcasterScreen';
import RescueScreen from '../dashboard/RescueDashboard';

const Tab = createBottomTabNavigator();

function HomeScreen() {
  const { role, isServiceRunning, detectedDevices } = useAppStore();

  let roleColor = '#00C853';
  if (role === 'idle') {
    roleColor = 'white';
  } else if (role === 'broadcaster') {
    roleColor = '#E8001C';
  }

  return (
    <View style={styles.homeContainer}>
      <Text style={styles.homeLabel}>CURRENT ROLE</Text>
      <Text style={[styles.homeRoleText, { color: roleColor }]}>
        {role.toUpperCase()}
      </Text>

      <View style={styles.divider} />

      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.colLabel}>MESH STATUS</Text>
          <Text
            style={[
              styles.colValue,
              { color: isServiceRunning ? '#00C853' : '#444' },
            ]}
          >
            {isServiceRunning ? 'ACTIVE' : 'INACTIVE'}
          </Text>
        </View>

        <View style={styles.column}>
          <Text style={styles.colLabel}>NEARBY</Text>
          <Text style={[styles.colValue, {
            color: (detectedDevices.length + (role === 'broadcaster' ? 1 : 0)) > 0 ? '#00C853' : 'white'
          }]}>
            {(
              detectedDevices.length +
              (role === 'broadcaster' ? 1 : 0)
            ).toString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopWidth: 1,
          borderTopColor: '#222222',
          height: 80,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: 16,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 2,
        },
        tabBarActiveTintColor: '#E8001C',
        tabBarInactiveTintColor: '#666666',
      }}
    >
      <Tab.Screen name="HOME" component={HomeScreen} />
      <Tab.Screen name="SOS" component={SOSScreen} />
      <Tab.Screen name="RESCUE" component={RescueScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#444',
    fontSize: 13,
  },
  homeContainer: {
    backgroundColor: '#0A0A0A',
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  homeLabel: {
    fontSize: 10,
    letterSpacing: 3,
    color: '#666',
  },
  homeRoleText: {
    fontSize: 32,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#1C1C1C',
    marginVertical: 24,
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
  },
  colLabel: {
    fontSize: 9,
    letterSpacing: 3,
    color: '#666',
  },
  colValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
});
