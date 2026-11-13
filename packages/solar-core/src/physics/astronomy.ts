import { getIstClockParts } from '../time/istDate.ts';
import { SOLAR_CONSTANTS } from './constants.ts';
import type { AstronomicalSunTimes } from '../types/physics.ts';

export type { AstronomicalSunTimes };

/**
 * Formats integer minute since midnight into 12-hour upper clock ("06:24 AM", "12:05 PM").
 */
export function formatMinutes12hUpper(totalMinutes: number): string {
  const mNorm = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(mNorm / 60);
  const m = mNorm % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Extracts minutes since midnight from an ISO timestamp or clock string ("2026-11-11T06:24").
 */
export function parseIsoClockMinutes(iso?: string | null): number | null {
  if (!iso) return null;
  const match = String(iso).match(/T?(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Formats duration in integer minutes cleanly ("10h 56m", "45m").
 */
export function formatDurationHm(totalMinutes: number): string {
  const safeMin = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safeMin / 60);
  const m = safeMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Deterministic NOAA solar ephemeris solver for India (IST, UTC+5:30).
 * Ensures every back-date from commissioning through Today gets
 * accurate astronomical sunrise, solar noon, and sunset even if offline.
 */
export function computeAstronomicalSunTimes(
  lat: number = SOLAR_CONSTANTS.DEFAULT_LAT,
  lon: number = SOLAR_CONSTANTS.DEFAULT_LON,
  ymd?: string
): AstronomicalSunTimes {
  const safeYmd = ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : getIstClockParts().ymd;
  const [y, m, d] = safeYmd.split('-').map((n) => parseInt(n, 10));
  const dateUtc = Date.UTC(y, (m || 1) - 1, d || 1);
  const startOfYearUtc = Date.UTC(y, 0, 1);
  const doy = Math.floor((dateUtc - startOfYearUtc) / 86400000) + 1;

  const gamma = ((2 * Math.PI) / 365) * (doy - 1);
  const eotMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const declRad =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = (lat * Math.PI) / 180;
  const zenithRad = (90.833 * Math.PI) / 180;
  const cosHa = Math.max(
    -0.99,
    Math.min(0.99, Math.cos(zenithRad) / (Math.cos(latRad) * Math.cos(declRad)) - Math.tan(latRad) * Math.tan(declRad))
  );
  const haDeg = (Math.acos(cosHa) * 180) / Math.PI;
  const tzOffsetMin = 330; // IST = UTC+05:30

  const noonMin = Math.round(720 - 4 * lon - eotMin + tzOffsetMin);
  const sunriseMin = Math.round(720 - 4 * (lon + haDeg) - eotMin + tzOffsetMin);
  const sunsetMin = Math.round(720 - 4 * (lon - haDeg) - eotMin + tzOffsetMin);
  const daylightMin = Math.max(1, sunsetMin - sunriseMin);

  return {
    sunriseMin,
    sunsetMin,
    noonMin,
    daylightMin,
    sunriseText: formatMinutes12hUpper(sunriseMin),
    sunsetText: formatMinutes12hUpper(sunsetMin),
    noonText: formatMinutes12hUpper(noonMin),
    daylightText: formatDurationHm(daylightMin),
  };
}
