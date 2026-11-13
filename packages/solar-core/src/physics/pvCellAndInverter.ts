import { SOLAR_CONSTANTS } from './constants.ts';
import { computeAtmosphericAerosolTransmittance } from './atmosphere.ts';
import type { EffectiveSolarPrParams, EffectiveSolarPrResult } from '../types/physics.ts';
import type { InverterLossCoeffs, MountingType } from '../types/settings.ts';

export type { EffectiveSolarPrParams, EffectiveSolarPrResult };

/**
 * Physical 3-term quadratic Waaree inverter loss model:
 * P_loss(kW) = P_tare + alpha_1 * P_dc + alpha_2 * P_dc^2 (scaled by AC rating if != 3 kW)
 * Cut-off threshold below cutoffKw (52 W on 3 kW class); hard AC ceiling clip at acCapacityKw.
 */
export function computeInverterAcOutputKw(
  dcKw: number,
  acCapacityKw: number = SOLAR_CONSTANTS.DEFAULT_AC_CAPACITY_KW,
  coeffs?: Partial<InverterLossCoeffs> | null
): { acKw: number; lossKw: number; etaFrac: number } {
  const cap = acCapacityKw > 0 && Number.isFinite(acCapacityKw)
    ? acCapacityKw
    : SOLAR_CONSTANTS.DEFAULT_AC_CAPACITY_KW;
  const refAc =
    coeffs && Number.isFinite(coeffs.referenceAcKw as number) && Number(coeffs.referenceAcKw) > 0
      ? Number(coeffs.referenceAcKw)
      : SOLAR_CONSTANTS.DEFAULT_AC_CAPACITY_KW;
  const scale = cap / refAc;
  const tareKw =
    (coeffs && Number.isFinite(coeffs.tareKw as number) && Number(coeffs.tareKw) >= 0
      ? Number(coeffs.tareKw)
      : SOLAR_CONSTANTS.DEFAULT_INV_TARE_KW) * scale;
  const linearLoss =
    coeffs && Number.isFinite(coeffs.linearLoss as number) && Number(coeffs.linearLoss) >= 0
      ? Number(coeffs.linearLoss)
      : SOLAR_CONSTANTS.DEFAULT_INV_LINEAR_LOSS;
  const quadLoss =
    (coeffs && Number.isFinite(coeffs.quadLoss as number) && Number(coeffs.quadLoss) >= 0
      ? Number(coeffs.quadLoss)
      : SOLAR_CONSTANTS.DEFAULT_INV_QUAD_LOSS) / Math.max(0.25, scale);
  const cutoffKw =
    (coeffs && Number.isFinite(coeffs.cutoffKw as number) && Number(coeffs.cutoffKw) >= 0
      ? Number(coeffs.cutoffKw)
      : SOLAR_CONSTANTS.DEFAULT_INV_CUTOFF_KW) * scale;

  if (!Number.isFinite(dcKw) || dcKw <= cutoffKw) {
    return { acKw: 0, lossKw: Math.max(0, Number(dcKw) || 0), etaFrac: 0 };
  }

  const lossRaw = tareKw + linearLoss * dcKw + quadLoss * dcKw * dcKw;
  const rawAc = Math.max(0, dcKw - lossRaw);
  const acKw = Math.min(cap, rawAc);
  const lossKw = Math.max(0, dcKw - acKw);
  const etaFrac = dcKw > 0 ? Math.min(0.988, Math.max(0, acKw / dcKw)) : 0;
  return { acKw, lossKw, etaFrac };
}

/**
 * Exact tilted-surface Solar Incidence Angle cos(theta_inc) using Declination, EoT,
 * IST Solar Time, and Panel Orientation (tilt deg from horizontal, azimuth deg 0=South, -90=East, +90=West).
 */
export function computeTiltedIncidenceCosine(
  lat: number,
  lon: number,
  tiltDeg: number,
  azimuthDeg: number,
  ymd: string,
  minuteIst: number
): { cosThetaInc: number; cosThetaZ: number; zenithDeg: number; incidenceDeg: number; solarElevationDeg: number } {
  const safeLat = Number.isFinite(lat) ? lat : SOLAR_CONSTANTS.DEFAULT_LAT;
  const safeLon = Number.isFinite(lon) ? lon : SOLAR_CONSTANTS.DEFAULT_LON;
  const safeTilt = Math.max(0, Math.min(75, Number.isFinite(tiltDeg) ? tiltDeg : SOLAR_CONSTANTS.DEFAULT_TILT_DEG));
  const safeAz = Math.max(-180, Math.min(180, Number.isFinite(azimuthDeg) ? azimuthDeg : SOLAR_CONSTANTS.DEFAULT_AZIMUTH_DEG));

  let doy = 1;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || '');
  if (m) {
    const dt = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const jan1 = Date.UTC(Number(m[1]), 0, 1);
    doy = Math.max(1, Math.min(366, Math.floor((dt - jan1) / 86400000) + 1));
  }

  const DEG = Math.PI / 180;
  const bRad = ((2 * Math.PI) / 365) * (doy - 81);
  const eotMin = 9.87 * Math.sin(2 * bRad) - 7.53 * Math.cos(bRad) - 1.5 * Math.sin(bRad);
  const declRad = 23.44 * DEG * Math.sin(bRad);

  const lstmDeg = safeLon >= 65 && safeLon <= 100 ? 82.5 : Math.round(safeLon / 15) * 15;
  const solarTimeMin = minuteIst + 4 * (safeLon - lstmDeg) + eotMin;
  const omegaRad = ((solarTimeMin / 60 - 12) * 15) * DEG;

  const phiRad = safeLat * DEG;
  const cosZ = Math.max(
    -1,
    Math.min(1, Math.sin(phiRad) * Math.sin(declRad) + Math.cos(phiRad) * Math.cos(declRad) * Math.cos(omegaRad))
  );
  if (cosZ <= 0.01) {
    return { cosThetaInc: 0, cosThetaZ: 0, zenithDeg: 90, incidenceDeg: 90, solarElevationDeg: 0 };
  }

  const sinZ = Math.sqrt(Math.max(0, 1 - cosZ * cosZ));
  const cosAzSolar =
    sinZ > 1e-4 ? (cosZ * Math.sin(phiRad) - Math.sin(declRad)) / (sinZ * Math.cos(phiRad)) : 1;
  const sinAzSolar = sinZ > 1e-4 ? (Math.cos(declRad) * Math.sin(omegaRad)) / sinZ : 0;
  const gammaSolar = Math.atan2(sinAzSolar, cosAzSolar);

  const betaRad = safeTilt * DEG;
  const gammaPanel = safeAz * DEG;
  const cosInc = Math.max(
    0,
    Math.min(1, cosZ * Math.cos(betaRad) + sinZ * Math.sin(betaRad) * Math.cos(gammaSolar - gammaPanel))
  );

  const zenithDeg = +(Math.acos(cosZ) / DEG).toFixed(1);
  return {
    cosThetaInc: +cosInc.toFixed(4),
    cosThetaZ: +cosZ.toFixed(4),
    zenithDeg,
    incidenceDeg: +(Math.acos(cosInc) / DEG).toFixed(1),
    solarElevationDeg: +(90 - zenithDeg).toFixed(1),
  };
}

/**
 * Dusty ASHRAE Incident Angle Modifier with Fresnel Grazing Transition:
 * Couples grazing-angle reflection coefficient b_eff = 0.075 + 0.008 * surfaceLossPct
 * to accumulated dust/dew film so high incidence reflects ~11% on dusty glass.
 * Implements smooth continuous Fresnel taper below cosThetaInc < 0.12 to eliminate
 * non-physical step discontinuities at extreme morning/evening sun angles.
 */
export function computeAshraeIam(
  cosThetaInc: number,
  gtiWm2: number = 600,
  directWeight?: number,
  surfaceLossPct: number = 0
): number {
  const safeCos = Number.isFinite(cosThetaInc) ? Math.max(0, Math.min(1.0, cosThetaInc)) : 0;
  if (safeCos <= 0.01) return 0.60;
  const safeSurf = Math.max(0, Math.min(25, Number.isFinite(surfaceLossPct) ? surfaceLossPct : 0));
  const b0 = Math.min(0.16, SOLAR_CONSTANTS.IAM_BASE_B0 + SOLAR_CONSTANTS.IAM_SOILING_B0_SLOPE * safeSurf);
  
  // Continuous Fresnel transition at grazing incidence (cosThetaInc < 0.12)
  const effCos = Math.max(0.10, safeCos);
  const beamIam = Math.max(0.55, Math.min(1.0, 1 - b0 * (1 / effCos - 1)));
  const wDirect =
    typeof directWeight === 'number' && Number.isFinite(directWeight)
      ? Math.max(0.15, Math.min(0.92, directWeight))
      : Math.max(0.2, Math.min(0.85, gtiWm2 / 850));
  const iam = wDirect * beamIam + (1 - wDirect) * 0.955;
  return +Math.max(0.58, Math.min(1.0, iam)).toFixed(4);
}

/**
 * Computes PV cell temperature using the King / Faiman convective boundary-layer formulation:
 * T_cell = T_amb + (G_eff / 800) * riseCoeff(v_wind, mounting)
 * Accounting for ambient air temperature, effective tilted irradiance (G_eff),
 * convective wind cooling, and array mounting airflow (open pergola 27C vs flush RCC 31C).
 */
export function computeCellTempC(
  ambientTempC: number = 25,
  gtiWm2: number = 500,
  windSpeedKmh: number = 6,
  mountingType: MountingType = 'open_rack'
): number {
  const safeAmbient = Number.isFinite(ambientTempC) ? ambientTempC : 25;
  const safeGti = Math.max(0, Number.isFinite(gtiWm2) ? gtiWm2 : 0);
  const safeWind = Math.max(0, Number.isFinite(windSpeedKmh) ? windSpeedKmh : 6);
  // King / Faiman convective boundary cooling:
  // Convective heat transfer coefficient scales with wind speed;
  // At 6 km/h (calm baseline), windCooling is 3.3C; at 15 km/h breezy, up to 8.2C
  const windCooling = Math.min(10, safeWind * 0.55);
  const baseDelta = mountingType === 'flush_rcc' ? 31 : 27;
  const minDelta = mountingType === 'flush_rcc' ? 17 : 14;
  const riseCoeff = Math.max(minDelta, baseDelta - windCooling);
  return +(safeAmbient + (safeGti / 800) * riseCoeff).toFixed(1);
}

/**
 * Two-Stage Physical Performance Ratio breakdown:
 * Stage A (DC): K_dc_clean (0.950) * IAM * eta_temp(Tcell) * surfaceFactor * tau_smog * K_site
 * Stage B (AC): Physical 3-term quadratic Waaree inverter curve + AC ceiling clip
 */
export function computeEffectiveSolarPr(params: EffectiveSolarPrParams = {}): EffectiveSolarPrResult {
  const ambient = Number.isFinite(params.ambientTempC as number) ? Number(params.ambientTempC) : 25;
  const gti = Number.isFinite(params.gtiWm2 as number) ? Math.max(0, Number(params.gtiWm2)) : 500;
  const wind = Number.isFinite(params.windSpeedKmh as number) ? Math.max(0, Number(params.windSpeedKmh)) : 6;
  const mounting: MountingType = params.mountingType === 'flush_rcc' ? 'flush_rcc' : 'open_rack';

  const fallbackPm10 =
    Number.isFinite(params.pm10 as number)
      ? Number(params.pm10)
      : Number.isFinite(params.pm25 as number) && Number(params.pm25) > 0
        ? Number(params.pm25) * 1.9
        : SOLAR_CONSTANTS.ATMOS_PM10_TAIL_THRESHOLD;
  const atmosRes = computeAtmosphericAerosolTransmittance(
    Number.isFinite(params.cosThetaZ as number) ? Number(params.cosThetaZ) : 0.72,
    params.aod,
    fallbackPm10
  );
  const tauSmog = atmosRes.tauSmogCompat;
  const anomalyFrac = +(1 - atmosRes.tauAtmos).toFixed(4);

  const safeKSite = Number.isFinite(params.kSite as number)
    ? Math.min(SOLAR_CONSTANTS.KSITE_MAX, Math.max(SOLAR_CONSTANTS.KSITE_MIN, Number(params.kSite)))
    : SOLAR_CONSTANTS.DEFAULT_KSITE;
  const gEff = gti * atmosRes.tauAtmos;
  const cellTempC = computeCellTempC(ambient, gEff, wind, mounting);

  const thermalCoeff =
    Number.isFinite(params.thermalCoeffPerC as number) && Number(params.thermalCoeffPerC) > 0
      ? Number(params.thermalCoeffPerC)
      : SOLAR_CONSTANTS.THERMAL_COEFF_PER_C;
  const dcClean =
    Number.isFinite(params.dcCleanFactor as number) && Number(params.dcCleanFactor) > 0
      ? Number(params.dcCleanFactor)
      : Number.isFinite(params.basePrAtStc as number) && Number(params.basePrAtStc) > 0.88
        ? Number(params.basePrAtStc)
        : SOLAR_CONSTANTS.DC_CLEAN_FACTOR;
  const safeSurface = Math.max(
    0,
    Math.min(35, Number.isFinite(params.surfaceLossPct as number) ? Number(params.surfaceLossPct) : 0)
  );
  const iam =
    Number.isFinite(params.iamFactor as number) && Number(params.iamFactor) > 0
      ? Math.max(0.58, Math.min(1.0, Number(params.iamFactor)))
      : Number.isFinite(params.cosThetaInc as number)
        ? computeAshraeIam(Number(params.cosThetaInc), gEff, undefined, safeSurface)
        : 0.992;

  const tempFactor = Math.max(
    0.80,
    Math.min(1.06, 1 - thermalCoeff * (cellTempC - SOLAR_CONSTANTS.REF_CELL_TEMP_C))
  );
  const surfaceFactor = 1 - safeSurface / 100;

  const dcPr = dcClean * iam * tempFactor * surfaceFactor;
  const dcCap =
    Number.isFinite(params.dcCapacityKwp as number) && Number(params.dcCapacityKwp) > 0
      ? Number(params.dcCapacityKwp)
      : SOLAR_CONSTANTS.DEFAULT_CAPACITY_KWP;
  const acCap =
    Number.isFinite(params.acInverterCapacityKw as number) && Number(params.acInverterCapacityKw) > 0
      ? Number(params.acInverterCapacityKw)
      : dcCap;
  const dcKwSample = (gEff / 1000) * dcCap * safeKSite * dcPr;
  const invRes = computeInverterAcOutputKw(dcKwSample, acCap, params.inverterLossCoeffs);
  const inverterEta =
    dcKwSample > 0.05 && invRes.etaFrac > 0
      ? invRes.etaFrac
      : Number.isFinite(params.inverterEfficiency as number) && Number(params.inverterEfficiency) > 0
        ? Number(params.inverterEfficiency)
        : 0.935;

  const acOverDcRef = gti > 5 ? (invRes.acKw / ((gti / 1000) * dcCap)) : dcPr * inverterEta * tauSmog * safeKSite;
  const pr = Math.min(0.98, Math.max(0.35, +acOverDcRef.toFixed(4)));

  return {
    pr,
    dcPr: +dcPr.toFixed(4),
    dcKw: +dcKwSample.toFixed(3),
    acKw: +invRes.acKw.toFixed(3),
    cellTempC,
    tempFactor: +tempFactor.toFixed(4),
    surfaceFactor: +surfaceFactor.toFixed(4),
    smogFactor: +tauSmog.toFixed(4),
    tauSmog: +tauSmog.toFixed(4),
    smogLossFrac: +anomalyFrac.toFixed(4),
    inverterEta: +inverterEta.toFixed(4),
  };
}
