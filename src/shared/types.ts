export type AppRole = 'idle' | 'broadcaster' | 'relay' | 'listener';
export type RSSIState = 'hot' | 'warm' | 'cold';

export interface SOSPacket {
  userId: string;
  medicalTag?: string;
  timestamp: number;
}

export interface DetectedDevice {
  id: string;
  rssi: number;
  packet: SOSPacket;
  lastSeen: number;
}

export const getRSSIState = (rssi: number): RSSIState => {
  if (rssi >= -50) return 'hot';
  if (rssi >= -70) return 'warm';
  return 'cold';
};

export const RSSI_COLORS = {
  hot: '#00C853',
  warm: '#FFD600',
  cold: '#2979FF',
};

/**
 * Converts RSSI to distance in centimeters using the log-distance path loss model.
 * TxPower = -59 dBm (measured BLE power at 1 meter)
 * n = 2.0 (free-space path loss exponent)
 */
export const rssiToDistanceCm = (rssi: number): number => {
  const TX_POWER = -59; // dBm at 1 meter
  const N = 2.0;        // path loss exponent
  const distanceMeters = Math.pow(10, (TX_POWER - rssi) / (10 * N));
  return Math.round(distanceMeters * 100); // convert to cm
};

/**
 * Simple 1-D Kalman filter for noisy RSSI values.
 * Returns a new estimate given previous estimate and new measurement.
 */
export const kalmanFilterRSSI = (
  prevEstimate: number,
  measurement: number,
  processNoise: number = 0.008,
  measurementNoise: number = 25,
  prevError: number = 25
): { estimate: number; error: number } => {
  const kalmanGain = prevError / (prevError + measurementNoise);
  const estimate = prevEstimate + kalmanGain * (measurement - prevEstimate);
  const error = (1 - kalmanGain) * prevError + Math.abs(prevEstimate - estimate) * processNoise;
  return { estimate: Math.round(estimate), error };
};
