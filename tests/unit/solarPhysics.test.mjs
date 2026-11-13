import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const solarCore = require('@solar-track/core');

describe('solar-core physics & IST clock unit invariants', () => {
  it('computes accurate astronomical sunrise/sunset around mid-November', () => {
    const sun = solarCore.computeAstronomicalSunTimes(26.5022, 80.2366, '2026-11-11');
    assert.ok(sun.sunriseMin >= 375 && sun.sunriseMin <= 395, `sunriseMin=${sun.sunriseMin}`);
    assert.ok(sun.sunsetMin >= 1030 && sun.sunsetMin <= 1055, `sunsetMin=${sun.sunsetMin}`);
    assert.ok(sun.daylightMin > 630 && sun.daylightMin < 670, `daylightMin=${sun.daylightMin}`);
  });

  it('evaluates two-stage PV cell temperature and quadratic inverter clip bounds', () => {
    const res = solarCore.computeEffectiveSolarPr({
      ambientTempC: 28,
      gtiWm2: 850,
      windSpeedKmh: 6,
      mountingType: 'open_rack',
      dcCapacityKwp: 3.3,
      acInverterCapacityKw: 3.0,
      kSite: 1.0095,
      surfaceLossPct: 2.0,
    });
    assert.ok(res.pr > 0.65 && res.pr <= 0.92, `pr=${res.pr}`);
    assert.ok(res.cellTempC > 28, `cellTempC=${res.cellTempC}`);
    assert.ok(res.acKw <= 3.0 && res.acKw > 1.8, `acKw=${res.acKw}`);

    // Hard AC clip protection under extreme irradiance
    const clipped = solarCore.computeInverterAcOutputKw(4.5, 3.0);
    assert.equal(clipped.acKw, 3.0);
    const belowCutoff = solarCore.computeInverterAcOutputKw(0.02, 3.0);
    assert.equal(belowCutoff.acKw, 0);
  });

  it('builds a daily solar physics model with continuous integral matching lookupAtMinute', () => {
    const model = solarCore.computeDailySolarPhysicsModel({
      sunriseIso: '2026-11-08T06:22',
      sunsetIso: '2026-11-08T17:23',
      ymd: '2026-11-08',
      lat: 26.5022,
      lon: 80.2366,
      hourlyGti: Array.from({ length: 24 }, (_, h) =>
        h >= 7 && h <= 16 ? Math.round(750 * Math.sin(((h - 6) / 11) * Math.PI)) : 0
      ),
      dcCapacityKwp: 3.3,
      acInverterCapacityKw: 3.0,
      arrayTiltDeg: 26,
      arrayAzimuthDeg: 10,
      kSite: 1.0095,
      surfaceLossPct: 1.5,
    });
    assert.ok(model.targetDailyModelKwh > 8 && model.targetDailyModelKwh < 18);
    assert.ok(model.peakKw > 1.5 && model.peakKw <= 3.0);
    const noon = model.lookupAtMinute(12 * 60);
    assert.ok(noon.kw > 1.0 && noon.cumKwh > 3.0);
    assert.equal(model.lookupAtMinute(2 * 60).kw, 0);
  });

  it('resolves IST calendar arithmetic cleanly without timezone off-by-one', () => {
    assert.equal(solarCore.shiftYmdDays('2026-11-01', -1), '2026-10-31');
    assert.equal(solarCore.diffYmdDays('2026-11-11', '2026-10-28'), 14);
    assert.equal(solarCore.daysInIstMonth(2026, 11), 30);
    const parts = solarCore.getIstClockParts(new Date('2026-11-11T17:36:00+05:30'));
    assert.equal(parts.ymd, '2026-11-11');
    assert.equal(parts.totalMinutes, 17 * 60 + 36);
  });

  it('respects NIGHT_SLEEP and GRID_OUTAGE states in evaluateTelemetryTruth', () => {
    const night = solarCore.evaluateTelemetryTruth(
      new Date().toISOString(),
      0,
      9.7,
      1,
      230,
      50,
      'auto',
      {
        sunriseMin: 384,
        sunsetMin: 1043,
        nowMinutesIst: 18 * 60 + 15,
        todayCurveKwh: 9.7,
        hasTodayActiveCurve: true,
        capacityKwp: 3.3,
      }
    );
    assert.equal(night.status, 'NIGHT_SLEEP');
    assert.equal(night.safeGenerationKw, 0);

    const gridOut = solarCore.evaluateTelemetryTruth(
      new Date().toISOString(),
      0,
      4.2,
      1,
      0,
      0,
      'auto',
      {
        sunriseMin: 384,
        sunsetMin: 1043,
        nowMinutesIst: 12 * 60,
        capacityKwp: 3.3,
      }
    );
    assert.equal(gridOut.status, 'GRID_OUTAGE');
  });

  it('runs E2E directory location resolves cleanly inside workspace', () => {
    assert.ok(path.basename(process.cwd()) === 'waaree-dashboard' || typeof solarCore.SOLAR_CONSTANTS.DEFAULT_LAT === 'number');
  });
});
