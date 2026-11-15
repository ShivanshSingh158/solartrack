/**
 * 12-Month Calibration Simulation & Verification Script for Kanpur Rooftop.
 * Runs annual solar physics simulations across all 12 months (15th of each month)
 * and verifies yesterday's performance against the calibrated baseline.
 */

import fs from 'fs';
import {
  computeAstronomicalSunTimes,
  computeDailySolarPhysicsModel,
} from '../src/physics/index.ts';
import {
  KANPUR_12_MONTH_PROFILES,
  getKanpurMonthlyProfile,
  getKanpurProfileForDate,
} from '../src/calibration/monthlyProfiles.ts';

const LAT = 26.502213;
const LON = 80.236601;
const DC_KWP = 3.27;
const AC_KW = 3.0;
const TILT = 26.5;
const AZIMUTH = 0;

console.log('='.repeat(80));
console.log('       KANPUR ROOFTOP 12-MONTH DYNAMIC CALIBRATION SIMULATION REPORT');
console.log('       Location: Kanpur, UP (26.5022° N, 80.2366° E) | 3.27 kWp DC / 3.0 kW AC');
console.log('='.repeat(80));

const results: any[] = [];

for (let m = 1; m <= 12; m++) {
  const profile = getKanpurMonthlyProfile(m);
  const monthPad = String(m).padStart(2, '0');
  const simYmd = `2026-${monthPad}-15`;
  const astro = computeAstronomicalSunTimes(LAT, LON, simYmd);

  // Uncalibrated clear-sky model (flat laboratory conditions: kSite=1.0, zero shade)
  const uncalibrated = computeDailySolarPhysicsModel({
    sunriseIso: `${simYmd}T${String(Math.floor(astro.sunriseMin / 60)).padStart(2, '0')}:${String(astro.sunriseMin % 60).padStart(2, '0')}`,
    sunsetIso: `${simYmd}T${String(Math.floor(astro.sunsetMin / 60)).padStart(2, '0')}:${String(astro.sunsetMin % 60).padStart(2, '0')}`,
    ymd: simYmd,
    lat: LAT,
    lon: LON,
    capacityKwp: DC_KWP,
    dcCapacityKwp: DC_KWP,
    acInverterCapacityKw: AC_KW,
    arrayTiltDeg: TILT,
    arrayAzimuthDeg: AZIMUTH,
    kSite: 1.0,
    hourlyShadeFactors: null,
  });

  // Calibrated Kanpur model using monthly profile
  const calibrated = computeDailySolarPhysicsModel({
    sunriseIso: `${simYmd}T${String(Math.floor(astro.sunriseMin / 60)).padStart(2, '0')}:${String(astro.sunriseMin % 60).padStart(2, '0')}`,
    sunsetIso: `${simYmd}T${String(Math.floor(astro.sunsetMin / 60)).padStart(2, '0')}:${String(astro.sunsetMin % 60).padStart(2, '0')}`,
    ymd: simYmd,
    lat: LAT,
    lon: LON,
    capacityKwp: DC_KWP,
    dcCapacityKwp: DC_KWP,
    acInverterCapacityKw: AC_KW,
    arrayTiltDeg: TILT,
    arrayAzimuthDeg: AZIMUTH,
    kSite: profile.kSite,
    hourlyShadeFactors: profile.hourlyShadeFactors,
  });

  results.push({
    month: profile.monthName,
    season: profile.season,
    sunElev: `${profile.sunElevationMaxDeg.toFixed(1)}°`,
    uncalibratedKwh: uncalibrated.targetDailyModelKwh.toFixed(1),
    calibratedKwh: calibrated.targetDailyModelKwh.toFixed(1),
    calibratedPeakKw: calibrated.peakKw.toFixed(2),
    kSite: profile.kSite.toFixed(2),
    aod: profile.aodBaseline.toFixed(2),
    notes: profile.notes.slice(0, 42) + '...',
  });
}

console.log(
  '| Month     | Season   | Sun Elev | Uncalibrated | Calibrated | Exp Peak | K_site | AOD  | Climate Dynamics'
);
console.log(
  '|:----------|:---------|:--------:|:------------:|:----------:|:--------:|:------:|:----:|:----------------'
);
for (const r of results) {
  console.log(
    `| ${r.month.padEnd(9)} | ${r.season.padEnd(8)} | ${r.sunElev.padStart(8)} | ${(r.uncalibratedKwh + ' kWh').padStart(12)} | ${(r.calibratedKwh + ' kWh').padStart(10)} | ${(r.calibratedPeakKw + ' kW').padStart(8)} | ${r.kSite.padStart(6)} | ${r.aod.padStart(4)} | ${r.notes}`
  );
}

console.log('\n' + '='.repeat(80));
console.log('       YESTERDAY (14 NOV 2026) BENCHMARK VERIFICATION');
console.log('='.repeat(80));

const novProfile = getKanpurProfileForDate('2026-11-14');

// Load weather cache if available
let weatherCache: any = {};
try {
  weatherCache = JSON.parse(fs.readFileSync('./waaree-dashboard/data/cache/weather_history_cache.json', 'utf8'));
} catch {}

const w14 = weatherCache['26.5022_80.2366_2026-11-14'];

const uncalibrated14 = computeDailySolarPhysicsModel({
  sunriseIso: '2026-11-14T06:27',
  sunsetIso: '2026-11-14T17:19',
  ymd: '2026-11-14',
  lat: LAT,
  lon: LON,
  capacityKwp: DC_KWP,
  dcCapacityKwp: DC_KWP,
  acInverterCapacityKw: AC_KW,
  arrayTiltDeg: TILT,
  arrayAzimuthDeg: AZIMUTH,
  radiationMjM2: 14.9,
  hourlyGti: w14?.hourlyGti || [],
  minutely15Gti: w14?.minutely15Gti || [],
  kSite: 1.0,
  hourlyShadeFactors: null,
});

const calibrated14 = computeDailySolarPhysicsModel({
  sunriseIso: '2026-11-14T06:27',
  sunsetIso: '2026-11-14T17:19',
  ymd: '2026-11-14',
  lat: LAT,
  lon: LON,
  capacityKwp: DC_KWP,
  dcCapacityKwp: DC_KWP,
  acInverterCapacityKw: AC_KW,
  arrayTiltDeg: TILT,
  arrayAzimuthDeg: AZIMUTH,
  radiationMjM2: 14.9,
  hourlyGti: w14?.hourlyGti || [],
  minutely15Gti: w14?.minutely15Gti || [],
  kSite: novProfile.kSite,
  hourlyShadeFactors: novProfile.hourlyShadeFactors,
});

const realYield = 9.7;
const uncalMatch = Math.round((realYield / uncalibrated14.targetDailyModelKwh) * 100);
const calMatch = Math.round((realYield / calibrated14.targetDailyModelKwh) * 100);

console.log(`Measured Generation (EDay)  : ${realYield} kWh (Peak 1.74 kW)`);
console.log(`Uncalibrated Model Target   : ${uncalibrated14.targetDailyModelKwh} kWh (Peak ${uncalibrated14.peakKw} kW) -> Match: ${uncalMatch}%`);
console.log(`Calibrated Kanpur Target    : ${calibrated14.targetDailyModelKwh} kWh (Peak ${calibrated14.peakKw} kW) -> Match: ${calMatch}%`);
console.log(`Prediction Accuracy Gain    : +${calMatch - uncalMatch}% alignment with real rooftop generation!`);
console.log('='.repeat(80));
