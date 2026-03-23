/**
 * Device Performance Tier Detection
 *
 * Classifies the device into high / medium / low tiers based on:
 *   A) Cached tier from previous launch (sync, instant)
 *   B) Runtime calibration via UI-visible time after first render (async)
 *
 * Tier behaviour (consumers decide how to use it):
 *   high   — device is fast, can do more work eagerly
 *   medium — moderate device, be selective
 *   low    — slow device, defer as much as possible
 *
 * Usage:
 *   import { getDevicePerformanceTier, calibrateDevicePerformanceTier }
 *     from '@onekeyhq/shared/src/performance/devicePerformanceTier';
 *
 *   // Synchronous — returns cached tier or 'medium' on first launch
 *   const tier = getDevicePerformanceTier();
 *
 *   // Async — call once after UI is visible to calibrate & persist
 *   await calibrateDevicePerformanceTier();
 */

import { defaultLogger } from '../logger/logger';
import { syncStorage } from '../storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum EDevicePerformanceTier {
  high = 'high',
  medium = 'medium',
  low = 'low',
}

// ---------------------------------------------------------------------------
// Thresholds (ms) — UIVisibleTime: startup → UI visible
// ---------------------------------------------------------------------------

/** Devices rendering UI in under this are considered high-perf */
const HIGH_PERF_THRESHOLD_MS = 1500;
/** Devices slower than this are considered low-perf */
const LOW_PERF_THRESHOLD_MS = 3000;

// ---------------------------------------------------------------------------
// Module-level cache (survives across calls within the same JS session)
// ---------------------------------------------------------------------------

let cachedTier: EDevicePerformanceTier | undefined;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the device performance tier **synchronously**.
 *
 * - Reads from in-memory cache first (fastest)
 * - Falls back to MMKV sync storage (persisted from previous launch)
 * - Defaults to `medium` on first-ever launch
 *
 * Safe to call at any point, including during component render.
 */
export function getDevicePerformanceTier(): EDevicePerformanceTier {
  if (cachedTier) {
    return cachedTier;
  }

  const stored = syncStorage.getString(
    EAppSyncStorageKeys.onekey_device_performance_tier,
  );

  if (
    stored === EDevicePerformanceTier.high ||
    stored === EDevicePerformanceTier.medium ||
    stored === EDevicePerformanceTier.low
  ) {
    cachedTier = stored;
    defaultLogger.app.perf.logTime({
      message: `Device tier loaded from cache: ${cachedTier}`,
    });
    return cachedTier;
  }

  // First launch — default to medium (safe middle ground)
  cachedTier = EDevicePerformanceTier.medium;
  defaultLogger.app.perf.logTime({
    message: `Device tier defaulting to: ${cachedTier} (first launch)`,
  });
  return cachedTier;
}

/**
 * Calibrate the tier using the actual UI-visible time from
 * `LaunchOptionsManager`, then persist to storage for next launch.
 *
 * Call this **once** after the splash screen has dismissed (UI visible).
 * The result takes effect on the *next* app launch.
 */
export async function calibrateDevicePerformanceTier(): Promise<EDevicePerformanceTier> {
  const { default: LaunchOptionsManager } = await import(
    '../modules/LaunchOptionsManager'
  );

  const uiVisibleTime = await LaunchOptionsManager.getUIVisibleTime();

  let tier: EDevicePerformanceTier;

  if (uiVisibleTime > 0 && uiVisibleTime < HIGH_PERF_THRESHOLD_MS) {
    tier = EDevicePerformanceTier.high;
  } else if (uiVisibleTime > 0 && uiVisibleTime > LOW_PERF_THRESHOLD_MS) {
    tier = EDevicePerformanceTier.low;
  } else {
    // Between thresholds, or uiVisibleTime unavailable (0)
    tier = EDevicePerformanceTier.medium;
  }

  // Persist for next launch
  cachedTier = tier;
  syncStorage.set(
    EAppSyncStorageKeys.onekey_device_performance_tier,
    tier,
  );

  defaultLogger.app.perf.logTime({
    message: `Device tier calibrated: ${tier}`,
    data: {
      tier,
      uiVisibleTime,
      highThreshold: HIGH_PERF_THRESHOLD_MS,
      lowThreshold: LOW_PERF_THRESHOLD_MS,
    },
  });

  return tier;
}

/**
 * Force-set the tier (useful for dev settings / testing).
 */
export function setDevicePerformanceTier(
  tier: EDevicePerformanceTier,
): void {
  cachedTier = tier;
  syncStorage.set(
    EAppSyncStorageKeys.onekey_device_performance_tier,
    tier,
  );
}

/**
 * Reset cached tier (useful for testing or after app data clear).
 */
export function resetDevicePerformanceTier(): void {
  cachedTier = undefined;
  syncStorage.delete(EAppSyncStorageKeys.onekey_device_performance_tier);
}
