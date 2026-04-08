import { create } from 'zustand';
import { AppRole, DetectedDevice } from './types';

interface AppState {
  role: AppRole;
  userId: string;
  detectedDevices: DetectedDevice[];
  isServiceRunning: boolean;
  meshNodeCount: number;
  setRole: (role: AppRole) => void;
  setUserId: (id: string) => void;
  upsertDevice: (device: DetectedDevice) => void;
  clearDevices: () => void;
  setServiceRunning: (v: boolean) => void;
  incrementMeshCount: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  role: 'idle',
  userId: `USER-${Math.random().toString(36).substring(2, 11)}`,
  detectedDevices: [],
  isServiceRunning: false,
  meshNodeCount: 0,
  setRole: (role) => set({ role }),
  setUserId: (userId) => set({ userId }),
  upsertDevice: (device) =>
    set((state) => {
      const index = state.detectedDevices.findIndex((d) => d.id === device.id);
      if (index > -1) {
        const newDevices = [...state.detectedDevices];
        newDevices[index] = device;
        return { detectedDevices: newDevices };
      }
      return { 
        detectedDevices: [...state.detectedDevices, device],
        meshNodeCount: state.meshNodeCount + 1
      };
    }),
  clearDevices: () => set({ detectedDevices: [], meshNodeCount: 0 }),
  setServiceRunning: (isServiceRunning) => set({ isServiceRunning }),
  incrementMeshCount: () => set((state) => ({ meshNodeCount: state.meshNodeCount + 1 })),
}));
