import { SOLAR_CONSTANTS } from './constants.ts';
import type { AtmosphericAerosolResult } from '../types/physics.ts';

export type { AtmosphericAerosolResult };

/**
 * Unified Column AOD + Slant Air-Mass Beer-Lambert aerosol extinction.
 * Avoids artificial >8% clear-sky afternoon boosts when PM10 drops <140 while
 * still penalizing high column AOD or heavy boundary-layer smog tails (>150 ug/m3).
 */
export function computeAtmosphericAerosolTransmittance(
  cosThetaZ: number,
  aod?: number | null,
  pm10?: number | null
): AtmosphericAerosolResult {
  const safeCosZ = Number.isFinite(cosThetaZ) ? Math.max(0.08, Math.min(1.0, cosThetaZ)) : 0.5;
  const airMass = Math.max(1.0, Math.min(3.0, 1.0 / safeCosZ));
  const safeAod =
    aod !== null && aod !== undefined && Number.isFinite(aod) && aod > 0
      ? Math.max(0.05, Math.min(2.5, Number(aod)))
      : SOLAR_CONSTANTS.ATMOS_AOD_REF;
  const safePm10 =
    pm10 !== null && pm10 !== undefined && Number.isFinite(pm10) && pm10 >= 0
      ? Number(pm10)
      : SOLAR_CONSTANTS.ATMOS_PM10_TAIL_THRESHOLD;

  const pm10Tail =
    SOLAR_CONSTANTS.ATMOS_PM10_TAIL_SLOPE *
    Math.max(0, safePm10 - SOLAR_CONSTANTS.ATMOS_PM10_TAIL_THRESHOLD);
  const deltaTauCol = (safeAod - SOLAR_CONSTANTS.ATMOS_AOD_REF) + pm10Tail;
  const rawTau = Math.exp(-SOLAR_CONSTANTS.ATMOS_BEER_LAMBERT_K * deltaTauCol * airMass);
  const tauAtmos = +Math.max(
    SOLAR_CONSTANTS.ATMOS_TAU_MIN,
    Math.min(SOLAR_CONSTANTS.ATMOS_TAU_MAX, rawTau)
  ).toFixed(4);
  const colCompat = +Math.max(
    SOLAR_CONSTANTS.ATMOS_TAU_MIN,
    Math.min(SOLAR_CONSTANTS.ATMOS_TAU_MAX, Math.exp(-SOLAR_CONSTANTS.ATMOS_BEER_LAMBERT_K * deltaTauCol))
  ).toFixed(4);
  const slantCompat = colCompat > 0 ? +(tauAtmos / colCompat).toFixed(4) : 1.0;

  return {
    tauAtmos,
    deltaTauCol: +deltaTauCol.toFixed(4),
    airMass: +airMass.toFixed(3),
    tauSmogCompat: colCompat,
    tauSlantCompat: slantCompat,
  };
}

/**
 * Boundary-layer aerosol transmittance anchored to PM10 excess above climatology.
 * Only applies mild compensation up to 1.03 and never inflates PM10 < 140 by +8.5%.
 */
export function computeSmogAnomalyTransmittance(pm10?: number | null, aod?: number | null): {
  tauSmog: number;
  anomalyFrac: number;
} {
  if (Number.isFinite(aod as number) && Number(aod) > 0) {
    const res = computeAtmosphericAerosolTransmittance(0.7, aod, pm10);
    return {
      tauSmog: res.tauSmogCompat,
      anomalyFrac: +(1 - res.tauSmogCompat).toFixed(4),
    };
  }
  if (!Number.isFinite(pm10 as number) || Number(pm10) < 0) {
    return { tauSmog: 1.0, anomalyFrac: 0 };
  }
  const excessPm10 = Math.max(0, Number(pm10) - SOLAR_CONSTANTS.ATMOS_PM10_TAIL_THRESHOLD);
  const raw = Math.exp(-SOLAR_CONSTANTS.ATMOS_BEER_LAMBERT_K * SOLAR_CONSTANTS.ATMOS_PM10_TAIL_SLOPE * excessPm10);
  const tauSmog = Math.min(SOLAR_CONSTANTS.SMOG_TAU_MAX, Math.max(SOLAR_CONSTANTS.SMOG_TAU_MIN, raw));
  return {
    tauSmog: +tauSmog.toFixed(4),
    anomalyFrac: +(1 - tauSmog).toFixed(4),
  };
}

/**
 * Smooth Beer-Lambert Slant-Path Boundary-Layer Haze Extinction.
 * At midday (AM <= 1.40), tau_slant = 1.000 (zero peak impact).
 * At low solar elevation, longer path length smoothly attenuates light in proportion to hourly PM10.
 */
export function computeSlantPathSmogTransmittance(
  cosThetaZ: number,
  pm10?: number | null
): { tauSlant: number; airMass: number } {
  const sinAlpha = Math.max(0.05, Math.min(1.0, Number.isFinite(cosThetaZ) ? cosThetaZ : 1.0));
  const airMass = 1 / sinAlpha;
  const excessAm = Math.max(
    0,
    Math.min(SOLAR_CONSTANTS.SLANT_AIRMASS_MAX, airMass) - SOLAR_CONSTANTS.SLANT_AIRMASS_REF
  );
  if (excessAm <= 0) {
    return { tauSlant: 1.0, airMass: +airMass.toFixed(3) };
  }
  const safePm10 =
    Number.isFinite(pm10 as number) && Number(pm10) >= 0
      ? Number(pm10)
      : SOLAR_CONSTANTS.SMOG_PM10_CLIMATOLOGY_BASELINE;
  const tauSlant = Math.exp(
    -SOLAR_CONSTANTS.SLANT_EXTINCTION_COEFF *
      (safePm10 / SOLAR_CONSTANTS.SLANT_PM10_NORM) *
      excessAm
  );
  return {
    tauSlant: +Math.max(0.45, Math.min(1.0, tauSlant)).toFixed(4),
    airMass: +airMass.toFixed(3),
  };
}
