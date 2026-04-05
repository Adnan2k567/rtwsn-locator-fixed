import { useSyncExternalStore } from 'react';
import { NativeModules } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { SOS_SERVICE_UUID, RELAY_COOLDOWN_MS, RELAY_BURST_DURATION_MS } from '../shared/bleConstants';
import { useAppStore } from '../shared/store';
import type { DetectedDevice, SOSPacket } from '../shared/types';
import { shouldRelay } from './debounceCache';
import { MY_SESSION_JITTER_MS } from './relayJitter';

declare const Buffer: {
  from(data: string, encoding: 'base64'): { toString(encoding: 'utf8'): string };
};

type ScanDevice = {
  id: string;
  name?: string | null;
  rssi?: number | null;
  manufacturerData?: string | null;
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
  managerRef?.stopDeviceScan();
  managerRef = null;
  activeTimers.forEach(clearTimeout);
  activeTimers.clear();
  void NativeModules.BLEAdvertiser?.stopAdvertising();
  isRelayingState = false;
  notify();
}

function startRelayingFn() {
  if (isRelayingState) return;
  const manager = new BleManager();
  managerRef = manager;
  isRelayingState = true;
  notify();
  manager.startDeviceScan([SOS_SERVICE_UUID], { allowDuplicates: true }, (error: unknown, device: ScanDevice | null) => {
    if (error || !device) return;
    const userId = device.name ?? device.id;
    let packet: SOSPacket;
    try {
      const raw = device.manufacturerData
        ? Buffer.from(device.manufacturerData, 'base64').toString('utf8')
        : '';
      packet = JSON.parse(raw) as SOSPacket;
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
          await NativeModules.BLEAdvertiser?.startAdvertising(SOS_SERVICE_UUID, JSON.stringify(packet));
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
