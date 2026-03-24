// Web / Extension: navigator.deviceMemory (Chrome/Chromium only, returns GB)

let cached: number | null | undefined;

export async function getDeviceMemoryGB(): Promise<number | null> {
  if (cached !== undefined) {
    return cached;
  }
  if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
    const memGB = (navigator as { deviceMemory?: number }).deviceMemory;
    if (typeof memGB === 'number' && memGB > 0) {
      cached = memGB;
      return cached;
    }
  }
  cached = null;
  return cached;
}
