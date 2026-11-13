import type { SolarIntelligenceReport } from '@solar-track/core';

const SOILING_CACHE_KEY = 'waaree_cached_soiling_v1';

export interface CachedSoilingStore {
  latest?: { ymd: string; soiling: SolarIntelligenceReport['soiling'] };
  byStation?: Record<string, { ymd: string; soiling: SolarIntelligenceReport['soiling'] }>;
}

/** Reads the locally cached panel soiling estimate keyed by station ID. */
export function readCachedSoilingStore(): CachedSoilingStore {
  try {
    const raw = localStorage.getItem(SOILING_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CachedSoilingStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Persists the latest station soiling snapshot in localStorage for instant cold start. */
export function writeCachedSoilingStore(
  stationKey: string,
  ymd: string,
  soiling: SolarIntelligenceReport['soiling'],
): CachedSoilingStore {
  const prev = readCachedSoilingStore();
  const entry = { ymd, soiling };
  const next: CachedSoilingStore = {
    latest: entry,
    byStation: {
      ...(prev.byStation || {}),
      [stationKey]: entry,
    },
  };
  try {
    localStorage.setItem(SOILING_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors cleanly
  }
  return next;
}
