import { useSyncExternalStore } from 'react';
import { NativeModules } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { SOS_SERVICE_UUID, RELAY_COOLDOWN_MS, RELAY_BURST_DURATION_MS } from '../shared/bleConstants';
import { useAppStore } from '../shared/store';
import type { DetectedDevice, SOSPacket } from '../shared/types';
import { shouldRelay } from './debounceCache';
import { MY_SESSION_JITTER_MS } from './relayJitter';
import { encodeSosPayload, decodeSosPayload } from '../shared/sosPayload';

declare const Buffer: {
  from(data: string, encoding: 'base64'): { toString(encoding: 'utf8'): string };
};

type ScanDevice = {
  id: string;
  name?: string | null;
  rssi?: number | null;
  manufacturerData?: string | null;
  serviceUUIDs?: string[] | null;
  serviceData?: Record<string, string> | null;
};

let managerRef: BleManager | null = null;
const activeTimers = new Set<ReturnType<typeof setTimeout>>();

let isRelayingState = false;
let relayCountState = 0;
let snapshot = { isRelaying: isRelayingState, relayCount: relayCountState };
const storeListeners = new Set<() => void>();

function notify() {
  if (snapshot.isRelaying === isRelayingState && snapshot.relayCount === relayCountState) {
    return;
  }
  snapshot = { isRelaying: isRelayingState, relayCount: relayCountState };
  storeListeners.forEach((l) => l());
}

function subscribe(onStoreChange: () => void) {
  storeListeners.add(onStoreChange);
  return () => storeListeners.delete(onStoreChange);
}

function getSnapshot() {
  return snapshot;
}

function stopRelayingFn() {
  if (managerRef) {
    managerRef.stopDeviceScan();
    managerRef.destroy(); // FIX #1: release native BLE resources to prevent memory leak/crash
    managerRef = null;
  }
  activeTimers.forEach(clearTimeout);
  activeTimers.clear();
  NativeModules.BLEAdvertiser?.stopAdvertising()?.catch(() => { });
  isRelayingState = false;
  notify();
}

function startRelayingFn() {
  if (isRelayingState) return;
  const manager = new BleManager();
  managerRef = manager;
  isRelayingState = true;
  notify();
  manager.startDeviceScan(null, { allowDuplicates: true }, (error: unknown, device: ScanDevice | null) => {
    if (error || !device) return;
    // Only relay confirmed SOS devices:
    // - service UUID matches, OR
    // - manufacturer payload decodes with our prefix (PA1|...)
    // BOMBSHELL FIX: Explicit, unbreakable filter evaluation
    let isAuthenticSOS = false;
    const deviceName = device.name ?? '';
    if (deviceName.startsWith('PA-SOS')) {
      isAuthenticSOS = true;
    }

    const targetUUID = '0000aa00-0000-1000-8000-00805f9b34fb';
    if (device.serviceUUIDs && Array.isArray(device.serviceUUIDs)) {
      for (let i = 0; i < device.serviceUUIDs.length; i++) {
        if (device.serviceUUIDs[i].toLowerCase() === targetUUID) {
          isAuthenticSOS = true;
          break;
        }
      }
    }

    try {
      const matchKey = device.serviceData ? Object.keys(device.serviceData).find(k => k.toLowerCase() === targetUUID) : undefined;
      const sdB64 = matchKey ? device.serviceData![matchKey] : null;
      const sdRaw = sdB64 ? Buffer.from(sdB64, 'base64').toString('utf8') : '';
      const sdUserId = decodeSosPayload(sdRaw)?.userId;
      if (sdUserId) {
        isAuthenticSOS = true;
      } else {
        const raw = device.manufacturerData
          ? Buffer.from(device.manufacturerData, 'base64').toString('utf8')
          : '';
        if (decodeSosPayload(raw)?.userId) {
          isAuthenticSOS = true;
        }
      }
    } catch {
      // ignore
    }

    if (!isAuthenticSOS) return;
    const userId = device.name ?? device.id;
    let packet: SOSPacket;
    try {
      const matchKey = device.serviceData ? Object.keys(device.serviceData).find(k => k.toLowerCase() === targetUUID) : undefined;
      const sdB64 = matchKey ? device.serviceData![matchKey] : null;
      const sdRaw = sdB64 ? Buffer.from(sdB64, 'base64').toString('utf8') : '';
      const sdParsed = decodeSosPayload(sdRaw);
      if (sdParsed.userId) {
        packet = { userId: sdParsed.userId, timestamp: Date.now() };
      } else {
        const raw = device.manufacturerData
          ? Buffer.from(device.manufacturerData, 'base64').toString('utf8')
          : '';
        const parsed = decodeSosPayload(raw);
        packet = { userId: parsed.userId || userId, timestamp: Date.now() };
      }
    } catch {
      packet = { userId, timestamp: Date.now() };
    }
    const detected: DetectedDevice = {
      id: device.id,
      rssi: device.rssi ?? -99,
      packet,
      lastSeen: Date.now(),
    };
    useAppStore.getState().upsertDevice(detected);
    if (shouldRelay(userId, RELAY_COOLDOWN_MS)) {
      const t = setTimeout(async () => {
        try {
          await NativeModules.BLEAdvertiser?.startAdvertising(SOS_SERVICE_UUID, encodeSosPayload(packet.userId));
          const stopT = setTimeout(() => {
            NativeModules.BLEAdvertiser?.stopAdvertising();
          }, RELAY_BURST_DURATION_MS);
          activeTimers.add(stopT);
        } catch (e) {
          console.warn('[Relay] advertise error', e);
        }
        relayCountState += 1;
        notify();
      }, MY_SESSION_JITTER_MS);
      activeTimers.add(t);
    }
  });
}

export const useRelay = () => {
  const { isRelaying, relayCount } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { isRelaying, relayCount, startRelaying: startRelayingFn, stopRelaying: stopRelayingFn };
};
