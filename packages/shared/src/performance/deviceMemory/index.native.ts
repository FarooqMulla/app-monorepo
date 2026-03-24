// Native (iOS/Android): expo-device totalMemory (bytes → GB)
import * as ExpoDevice from 'expo-device';

let cached: number | null | undefined;

export async function getDeviceMemoryGB(): Promise<number | null> {
  if (cached !== undefined) {
    return cached;
  }
  const totalMem = ExpoDevice.totalMemory;
  if (typeof totalMem === 'number' && totalMem > 0) {
    cached = totalMem / (1024 * 1024 * 1024);
    return cached;
  }
  cached = null;
  return cached;
}
