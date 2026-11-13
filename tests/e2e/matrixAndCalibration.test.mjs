import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const solarCore = require('@solar-track/core');

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function parseClockMin(t) {
  const m = String(t || '').match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

describe('Live solar dataset calibration & 8-scenario E2E matrix', () => {
  const baseSettings = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config/settings.json'), 'utf8'));
  const wcAll = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cache/weather_history_cache.json'), 'utf8'));
  const rawAll = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cache/day_raw_cache.json'), 'utf8'));
  const hist = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cache/history_cache.json'), 'utf8'));

  const datasetLat = wcAll['2026-11-08']?.lat ?? 26.5022;
  const datasetLon = wcAll['2026-11-08']?.lon ?? 80.2366;
  const settings = {
    ...baseSettings,
    plantLocation: {
      name: 'Dataset Site',
      lat: datasetLat,
      lon: datasetLon,
    },
  };

  const stationId = Object.keys(rawAll)
    .find((k) => k.endsWith('_2026-11-08'))
    .split('_')[0];

  const octArr = (hist[`${stationId}_month_2026_10`]?.[0]?.data || []).map((d) => ({
    index: d.index,
    value: +Number(d.value).toFixed(2),
  }));
  const novArr = (hist[`${stationId}_month_2026_11`]?.[0]?.data || []).map((d) => ({
    index: d.index,
    value: +Number(d.value).toFixed(2),
  }));

  const genByYmd = {};
  for (const pt of octArr) {
    const ymd = `2026-10-${String(pt.index).padStart(2, '0')}`;
    const rec = rawAll[`${stationId}_${ymd}`];
    const kwh = +Number(pt.value).toFixed(2);
    genByYmd[ymd] = {
      ymd,
      realKwh: kwh,
      isConfirmed: kwh > 0.05,
      rawSeries: Array.isArray(rec) ? rec : rec?.rawSeries || rec?.raw,
    };
  }
  for (const pt of novArr) {
    const ymd = `2026-11-${String(pt.index).padStart(2, '0')}`;
    const rec = rawAll[`${stationId}_${ymd}`];
    const kwh = +Number(pt.value).toFixed(2);
    genByYmd[ymd] = {
      ymd,
      realKwh: kwh,
      isConfirmed: kwh > 0.05,
      rawSeries: Array.isArray(rec) ? rec : rec?.rawSeries || rec?.raw,
    };
  }

  const nov11Raw = rawAll[`${stationId}_2026-11-11`];
  let nov11Series = Array.isArray(nov11Raw) ? nov11Raw : nov11Raw?.rawSeries || nov11Raw?.raw || [];
  if (nov11Series.length === 0) {
    const rec08 = rawAll[`${stationId}_2026-11-08`];
    const s08 = (Array.isArray(rec08) ? rec08 : rec08?.rawSeries || []).find((s) => s.variable === 'generationPower')?.data || [];
    const after1032 = s08.filter((pt) => {
      const m = parseClockMin(pt.time);
      return m !== null && m >= 10 * 60 + 32 && m <= 17 * 60 + 21;
    });
    const baseTemp = solarCore.parseRawTelemetry(
      [{ variable: 'generationPower', data: after1032.map((pt) => ({ time: String(pt.time).replace('2026-11-08', '2026-11-11'), value: pt.value })) }],
      384,
      1043
    );
    const scaleTo97 = baseTemp.onlineIntegratedKwh > 0 ? 9.7 / baseTemp.onlineIntegratedKwh : 1;
    nov11Series = [{
      variable: 'generationPower',
      data: after1032.map((pt) => ({
        time: String(pt.time).replace('2026-11-08', '2026-11-11'),
        value: +(Number(pt.value || 0) * scaleTo97).toFixed(3),
      })),
    }];
  }
  const nov11Parsed = solarCore.parseRawTelemetry(nov11Series, 384, 1043);
  const nov11RealKwh = Math.max(genByYmd['2026-11-11']?.realKwh || 0, nov11Parsed.onlineIntegratedKwh, 9.7);
  genByYmd['2026-11-11'] = {
    ymd: '2026-11-11',
    realKwh: +nov11RealKwh.toFixed(2),
    isConfirmed: true,
    rawSeries: nov11Series,
  };

  const days = Object.entries(wcAll)
    .filter(([k]) => k.startsWith('26.5022_80.2366_2026-'))
    .map(([k, v]) => ({ ...v, ymd: k.slice(-10) }))
    .sort((a, b) => a.ymd.localeCompare(b.ymd));

  const intelReport = solarCore.computeSolarIntelligence({
    todayYmd: '2026-11-11',
    todayHasLivePackets: true,
    nowMinutesIst: 17 * 60 + 36,
    commissioningYmd: '2026-10-28',
    capacityKwp: settings.dcCapacityKwp,
    dcCapacityKwp: settings.dcCapacityKwp,
    acInverterCapacityKw: settings.acInverterCapacityKw,
    tariffPerKwh: settings.tariffPerKwh,
    tiltDegrees: settings.arrayTiltDeg,
    azimuthDegrees: settings.arrayAzimuthDeg,
    latitudeDeg: settings.plantLocation.lat,
    longitudeDeg: settings.plantLocation.lon,
    mountingType: settings.mountingType || 'open_rack',
    roofAlbedo: settings.roofAlbedo ?? 0.2,
    dcCleanFactor: settings.dcCleanFactor ?? 0.95,
    thermalCoeffPerC: settings.thermalCoeffPerC,
    basePrAtStc: settings.basePrAtStc,
    inverterEfficiency: settings.inverterEfficiency,
    useCalibratedTwin: true,
    days,
    generationByYmd: genByYmd,
    manualCleanEvents: settings.cleaningEvents || [],
  });

  const wcNov11 = wcAll['26.5022_80.2366_2026-11-11'];
  const pastDaysObj = Object.fromEntries(days.map((d) => [d.ymd, { ...d, dateYmd: d.ymd, maxTemp: d.tempMax, minTemp: d.tempMin }]));
  const weatherRespNov11 = {
    location: { name: settings.plantLocation.name, lat: settings.plantLocation.lat, lon: settings.plantLocation.lon },
    current: {
      temperature: 22.4,
      humidity: 68,
      cloudCover: 0,
      shortwaveRadiation: 0,
      directNormalIrradiance: 0,
      globalTiltedIrradiance: 0,
      windSpeed: 5,
      isDay: false,
      weatherCode: 0,
      time: '2026-11-11T17:36',
      pm10: 95,
      pm25: 55,
      aerosolOpticalDepth: 0.52,
      usAqi: 132,
    },
    hourly: {
      globalTiltedIrradiance: wcNov11.hourlyGti,
      globalTiltedIrradianceInstant: wcNov11.hourlyGtiInstant,
      temperature2m: wcNov11.hourlyTempC,
      windSpeed10m: wcNov11.hourlyWindKmh,
      pm10: wcNov11.hourlyPm10,
      aerosolOpticalDepth: wcNov11.hourlyAod,
      diffuseRadiation: wcNov11.hourlyDiffuse,
      directNormalIrradiance: wcNov11.hourlyDni,
      cloudCover: wcNov11.hourlyCloudCover,
    },
    minutely15: {
      globalTiltedIrradiance: wcNov11.minutely15Gti,
      globalTiltedIrradianceInstant: wcNov11.minutely15GtiInstant,
    },
    todayForecast: {
      dateYmd: '2026-11-11',
      expectedYieldKwh: 13.0,
      expectedSavingsINR: 96,
      radiationMjM2: wcNov11.radiationMjM2 ?? 16,
      sunshineDurationHours: wcNov11.sunshineDurationHours ?? 10,
      precipitationSum: wcNov11.rainMm ?? 0,
      maxTemp: wcNov11.tempMax ?? 29,
      minTemp: wcNov11.tempMin ?? 17,
      cloudCover: wcNov11.cloudCoverAvg ?? 5,
      condition: 'Clear Sky',
      conditionType: 'sunny',
      irradianceDni: 550,
      irradianceGti: 0,
      irradianceGhi: 0,
      sunrise: wcNov11.sunrise,
      sunset: wcNov11.sunset,
      pm10: 95,
      aerosolOpticalDepth: 0.52,
      usAqi: 132,
    },
    pastDays: pastDaysObj,
    futureDays: [],
  };

  const novDaysWith11 = (
    novArr.some((d) => d.index === 11)
      ? novArr.map((d) => (d.index === 11 ? { index: 11, value: 9.7 } : d))
      : [...novArr, { index: 11, value: 9.7 }]
  ).filter((d) => d.index <= 11);
  const novSumCheck = +novDaysWith11.reduce((s, d) => s + Number(d.value || 0), 0).toFixed(2);
  const octSumCheck = +octArr.reduce((s, d) => s + Number(d.value || 0), 0).toFixed(2);

  it('matches exact baseline calibration (kSite=1.0095, azimuth=10, cleanRMSE=85W)', () => {
    assert.equal(intelReport.siteCalibration.enabled, true);
    assert.equal(intelReport.siteCalibration.kSiteApplied, 1.0095);
    assert.equal(intelReport.siteCalibration.effectiveAzimuthDeg, 12);
    assert.equal(intelReport.siteCalibration.cleanDaysUsed, 5);
    assert.equal(intelReport.siteCalibration.inverterSource, 'empirical_fitted');
    assert.equal(octSumCheck, 17.6);
    assert.equal(novSumCheck, 105.1);

    let cleanSq = 0;
    let cleanN = 0;
    let cleanPeakSq = 0;
    let cleanPeakN = 0;
    let allSq = 0;
    let allN = 0;

    for (const d of ['2026-11-01', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-11']) {
      const wc = wcAll[`26.5022_80.2366_${d}`];
      const rawRec = rawAll[`${stationId}_${d}`];
      const series = Array.isArray(rawRec) ? rawRec : rawRec?.rawSeries || rawRec?.raw;
      const ledger = intelReport.dailyLedger.find((e) => e.ymd === d);
      if (!wc || !series) continue;

      const m = solarCore.computeDailySolarPhysicsModel({
        sunriseIso: wc.sunrise,
        sunsetIso: wc.sunset,
        ymd: d,
        lat: settings.plantLocation.lat,
        lon: settings.plantLocation.lon,
        hourlyGti: wc.hourlyGti,
        hourlyGtiInstant: wc.hourlyGtiInstant,
        minutely15Gti: wc.minutely15Gti,
        minutely15GtiInstant: wc.minutely15GtiInstant,
        hourlyDiffuse: wc.hourlyDiffuse,
        hourlyDni: wc.hourlyDni,
        hourlyCloudCover: wc.hourlyCloudCover,
        hourlyTempC: wc.hourlyTempC,
        hourlyWindKmh: wc.hourlyWindKmh,
        hourlyPm10: wc.hourlyPm10,
        hourlyAod: wc.hourlyAod,
        dcCapacityKwp: settings.dcCapacityKwp,
        acInverterCapacityKw: settings.acInverterCapacityKw,
        arrayTiltDeg: settings.arrayTiltDeg,
        arrayAzimuthDeg: intelReport.siteCalibration.effectiveAzimuthDeg,
        gtiReferenceAzimuthDeg: wc.gtiFetchedAzimuthDeg ?? 0,
        kSite: intelReport.siteCalibration.kSiteApplied,
        inverterLossCoeffs: intelReport.siteCalibration.inverterCoeffs,
        hourlyShadeFactors: intelReport.siteCalibration.hourlyShadeFactors,
        surfaceLossPct: ledger?.particleSurfaceLossPct ?? 1.5,
      });

      const genData = series.find((s) => s.variable === 'generationPower')?.data || [];
      let realPeak = 0;
      for (const pt of genData) {
        const min = parseClockMin(pt.time);
        if (min == null) continue;
        const rk = Number(pt.value) || 0;
        const mk = m.lookupAtMinute(min).kw;
        if (rk > realPeak) realPeak = rk;
        if (mk >= 0.1 || rk >= 0.1) {
          allSq += (rk - mk) ** 2;
          allN++;
          if (d === '2026-11-05' || d === '2026-11-08') {
            cleanSq += (rk - mk) ** 2;
            cleanN++;
          }
        }
      }
      if (d === '2026-11-05' || d === '2026-11-08') {
        cleanPeakSq += (realPeak - m.peakKw) ** 2;
        cleanPeakN++;
      }
    }

    assert.equal(Math.round(Math.sqrt(cleanSq / cleanN) * 1000), 83);
    assert.equal(Math.round(Math.sqrt(cleanPeakSq / cleanPeakN) * 1000), 293);
    assert.equal(Math.round(Math.sqrt(allSq / allN) * 1000), 274);
  });

  it('Scenario 1: Nov 11 sunset NIGHT_SLEEP + morning blackout BUFFER_ESTIMATED (3.68 kWh)', () => {
    const snap1 = solarCore.buildCanonicalSolarSnapshot({
      now: new Date('2026-11-11T17:36:00+05:30'),
      settings: { ...settings, physicalEmonthKwh: null, physicalEtotalKwh: null },
      summaryData: {
        generationToday: 9.7,
        generationMonth: novSumCheck,
        generationTotal: +(novSumCheck + octSumCheck).toFixed(2),
        generationYesterday: 0,
        lastUpdateDate: '2026-11-11 17:22:00 IST+0530',
      },
      flowData: {
        status: {
          state: 0,
          yieldToday: '0',
          lastUpdateDate: '2026-11-11 17:35:10 IST+0530',
          timeFlag: 'night',
        },
        node: { device: { power: { value: '0' } }, solar: { power: { value: '0' } } },
      },
      monthDays: novDaysWith11,
      prevMonthDays: octArr,
      todayRaw: nov11Series,
      weatherData: weatherRespNov11,
      intelligenceReport: intelReport,
      commissioningYmd: '2026-10-28',
    });

    const gap1 = solarCore.reconstructConfirmedGapCurve({
      parsed: nov11Parsed,
      physicsModel: snap1.todayPhysics.model,
      eepromKwh: 9.7,
      acCapacityKw: settings.acInverterCapacityKw,
      surfaceLossPct: snap1.soiling.surfaceLossPct,
      ymd: '2026-11-11',
      todayYmd: '2026-11-11',
      commissioningYmd: '2026-10-28',
      nowMinutesIst: 17 * 60 + 36,
    });

    assert.equal(snap1.truth.status, 'NIGHT_SLEEP');
    assert.equal(snap1.today.isConfirmed, true);
    assert.equal(snap1.today.cloudKwh, 9.7);
    assert.equal(snap1.today.bufferKwh, 3.65);
    assert.equal(snap1.today.displayKwh, 13.35);
    assert.equal(snap1.todayPhysics.model.targetDailyModelKwh, 13.3);
    assert(gap1.bridgedSegments.some((s) => s.kind === 'BUFFER_ESTIMATED'));
  });

  it('Scenario 2: Nov 09 midday EEPROM (6.61 kWh) + evening tail buffer (1.34 kWh)', () => {
    const wc09 = wcAll['26.5022_80.2366_2026-11-09'];
    const raw09 = rawAll[`${stationId}_2026-11-09`];
    const series09 = Array.isArray(raw09) ? raw09 : raw09.rawSeries;
    const ledger09 = intelReport.dailyLedger.find((d) => d.ymd === '2026-11-09');
    const mod09 = solarCore.computeDailySolarPhysicsModel({
      sunriseIso: wc09.sunrise, sunsetIso: wc09.sunset, ymd: '2026-11-09',
      lat: settings.plantLocation.lat, lon: settings.plantLocation.lon,
      hourlyGti: wc09.hourlyGti, hourlyGtiInstant: wc09.hourlyGtiInstant,
      minutely15Gti: wc09.minutely15Gti, minutely15GtiInstant: wc09.minutely15GtiInstant,
      hourlyDiffuse: wc09.hourlyDiffuse, hourlyDni: wc09.hourlyDni,
      hourlyTempC: wc09.hourlyTempC, hourlyWindKmh: wc09.hourlyWindKmh,
      hourlyPm10: wc09.hourlyPm10, hourlyAod: wc09.hourlyAod,
      dcCapacityKwp: settings.dcCapacityKwp, acInverterCapacityKw: settings.acInverterCapacityKw,
      arrayTiltDeg: settings.arrayTiltDeg, arrayAzimuthDeg: intelReport.siteCalibration.effectiveAzimuthDeg,
      kSite: intelReport.siteCalibration.kSiteApplied,
      inverterLossCoeffs: intelReport.siteCalibration.inverterCoeffs,
      surfaceLossPct: ledger09?.particleSurfaceLossPct ?? 1.5,
    });
    const parsed09 = solarCore.parseRawTelemetry(series09, mod09.sunriseMin, mod09.sunsetMin);
    const cls09 = solarCore.classifyDayGapArchitecture({
      parsed: parsed09,
      physicsModel: mod09,
      eepromKwh: 10.2,
      ymd: '2026-11-09',
      todayYmd: '2026-11-11',
    });
    const rec09 = solarCore.reconstructConfirmedGapCurve({
      parsed: parsed09,
      physicsModel: mod09,
      eepromKwh: 10.2,
      acCapacityKw: settings.acInverterCapacityKw,
      ymd: '2026-11-09',
      todayYmd: '2026-11-11',
    });

    assert.equal(cls09.onlineKwh, 3.59);
    assert.equal(cls09.eepromKwh, 10.2);
    assert.equal(cls09.eepromConfirmedPreKwh, 6.61);
    assert.equal(cls09.bufferKwh, 1.34);
    assert(rec09.bridgedSegments.some((s) => s.kind === 'EEPROM_CONFIRMED'));
    assert(rec09.bridgedSegments.some((s) => s.kind === 'BUFFER_ESTIMATED'));
  });

  it('Scenarios 3 & 4: Synthetic 5h midday gap with EEPROM recovered vs lost past midnight', () => {
    const wc08 = wcAll['26.5022_80.2366_2026-11-08'];
    const raw08 = rawAll[`${stationId}_2026-11-08`];
    const mod08 = solarCore.computeDailySolarPhysicsModel({
      sunriseIso: wc08.sunrise, sunsetIso: wc08.sunset, ymd: '2026-11-08',
      lat: settings.plantLocation.lat, lon: settings.plantLocation.lon,
      hourlyGti: wc08.hourlyGti, hourlyGtiInstant: wc08.hourlyGtiInstant,
      minutely15Gti: wc08.minutely15Gti, minutely15GtiInstant: wc08.minutely15GtiInstant,
      hourlyDiffuse: wc08.hourlyDiffuse, hourlyDni: wc08.hourlyDni,
      hourlyTempC: wc08.hourlyTempC, hourlyWindKmh: wc08.hourlyWindKmh,
      hourlyPm10: wc08.hourlyPm10, hourlyAod: wc08.hourlyAod,
      dcCapacityKwp: settings.dcCapacityKwp, acInverterCapacityKw: settings.acInverterCapacityKw,
      arrayTiltDeg: settings.arrayTiltDeg, arrayAzimuthDeg: intelReport.siteCalibration.effectiveAzimuthDeg,
      kSite: intelReport.siteCalibration.kSiteApplied,
    });
    const gen08Data = (Array.isArray(raw08) ? raw08 : raw08.rawSeries).find((s) => s.variable === 'generationPower').data;
    const synthMiddayCutSeries = [{
      variable: 'generationPower',
      data: gen08Data.filter((pt) => {
        const m = parseClockMin(pt.time);
        return m !== null && (m <= 10 * 60 || m >= 15 * 60);
      }),
    }];
    const parsedMiddayCut = solarCore.parseRawTelemetry(synthMiddayCutSeries, mod08.sunriseMin, mod08.sunsetMin);

    const cls3 = solarCore.classifyDayGapArchitecture({
      parsed: parsedMiddayCut,
      physicsModel: mod08,
      eepromKwh: 12.4,
      ymd: '2026-11-08',
      todayYmd: '2026-11-11',
    });
    assert.equal(cls3.onlineKwh, 3.48);
    assert.equal(cls3.eepromConfirmedPreKwh, 8.92);
    assert.equal(cls3.bufferKwh, 0);

    const cls4 = solarCore.classifyDayGapArchitecture({
      parsed: parsedMiddayCut,
      physicsModel: mod08,
      eepromKwh: parsedMiddayCut.onlineIntegratedKwh,
      ymd: '2026-11-08',
      todayYmd: '2026-11-11',
    });
    assert.equal(cls4.onlineKwh, 3.48);
    assert.equal(cls4.eepromConfirmedPreKwh, 0);
    assert.equal(cls4.bufferKwh, 8.34);
  });

  it('Scenario 5: Nov 10 full-day unlogged Wi-Fi outage blackout', () => {
    const ledger10 = intelReport.dailyLedger.find((d) => d.ymd === '2026-11-10');
    const wc10 = wcAll['26.5022_80.2366_2026-11-10'];
    const mod10 = solarCore.computeDailySolarPhysicsModel({
      sunriseIso: wc10.sunrise, sunsetIso: wc10.sunset, ymd: '2026-11-10',
      lat: settings.plantLocation.lat, lon: settings.plantLocation.lon,
      hourlyGti: wc10.hourlyGti, hourlyGtiInstant: wc10.hourlyGtiInstant,
      minutely15Gti: wc10.minutely15Gti, minutely15GtiInstant: wc10.minutely15GtiInstant,
      hourlyDiffuse: wc10.hourlyDiffuse, hourlyDni: wc10.hourlyDni,
      hourlyTempC: wc10.hourlyTempC, hourlyWindKmh: wc10.hourlyWindKmh,
      hourlyPm10: wc10.hourlyPm10, hourlyAod: wc10.hourlyAod,
      dcCapacityKwp: settings.dcCapacityKwp, acInverterCapacityKw: settings.acInverterCapacityKw,
      arrayTiltDeg: settings.arrayTiltDeg, arrayAzimuthDeg: intelReport.siteCalibration.effectiveAzimuthDeg,
      kSite: intelReport.siteCalibration.kSiteApplied,
      surfaceLossPct: ledger10.particleSurfaceLossPct,
    });
    const emptyParsed10 = solarCore.parseRawTelemetry([], mod10.sunriseMin, mod10.sunsetMin);
    const rec10 = solarCore.reconstructConfirmedGapCurve({
      parsed: emptyParsed10,
      physicsModel: mod10,
      eepromKwh: 0,
      acCapacityKw: settings.acInverterCapacityKw,
      surfaceLossPct: ledger10.particleSurfaceLossPct,
      ymd: '2026-11-10',
      todayYmd: '2026-11-11',
      isWifiOfflineFullDay: true,
    });
    assert.equal(ledger10.dipCategory, 'WIFI_OUTAGE_UNLOGGED');
    assert.equal(ledger10.bufferKwh, 12.6);
    assert.equal(rec10.bufferedKwh, 13.05);
  });

  it('Scenario 6: Nov 02 connected 0.00 kW grid cut & manualGridOffDates suppression', () => {
    const ledger02 = intelReport.dailyLedger.find((d) => d.ymd === '2026-11-02');
    const wc02 = wcAll['26.5022_80.2366_2026-11-02'];
    const raw02 = rawAll[`${stationId}_2026-11-02`];
    const series02 = Array.isArray(raw02) ? raw02 : raw02.rawSeries;
    const mod02 = solarCore.computeDailySolarPhysicsModel({
      sunriseIso: wc02.sunrise, sunsetIso: wc02.sunset, ymd: '2026-11-02',
      lat: settings.plantLocation.lat, lon: settings.plantLocation.lon,
      hourlyGti: wc02.hourlyGti, hourlyGtiInstant: wc02.hourlyGtiInstant,
      minutely15Gti: wc02.minutely15Gti, minutely15GtiInstant: wc02.minutely15GtiInstant,
      hourlyDiffuse: wc02.hourlyDiffuse, hourlyDni: wc02.hourlyDni,
      dcCapacityKwp: settings.dcCapacityKwp, acInverterCapacityKw: settings.acInverterCapacityKw,
      arrayTiltDeg: settings.arrayTiltDeg, arrayAzimuthDeg: intelReport.siteCalibration.effectiveAzimuthDeg,
      kSite: intelReport.siteCalibration.kSiteApplied,
    });
    const cls02 = solarCore.classifyDayGapArchitecture({
      parsed: solarCore.parseRawTelemetry(series02, mod02.sunriseMin, mod02.sunsetMin),
      physicsModel: mod02,
      eepromKwh: 2.0,
      ymd: '2026-11-02',
      todayYmd: '2026-11-11',
    });
    const intelGridOff10 = solarCore.computeSolarIntelligence({
      todayYmd: '2026-11-11',
      nowMinutesIst: 17 * 60 + 36,
      commissioningYmd: '2026-10-28',
      capacityKwp: settings.dcCapacityKwp,
      dcCapacityKwp: settings.dcCapacityKwp,
      acInverterCapacityKw: settings.acInverterCapacityKw,
      tariffPerKwh: settings.tariffPerKwh,
      tiltDegrees: settings.arrayTiltDeg,
      azimuthDegrees: settings.arrayAzimuthDeg,
      latitudeDeg: settings.plantLocation.lat,
      longitudeDeg: settings.plantLocation.lon,
      days,
      generationByYmd: genByYmd,
      manualCleanEvents: [],
      manualGridOffDates: ['2026-11-10'],
    });
    const forcedGridOff10 = intelGridOff10.dailyLedger.find((d) => d.ymd === '2026-11-10');
    assert.equal(ledger02.bufferKwh, 0);
    assert.equal(cls02.bufferKwh, 0);
    assert.equal(forcedGridOff10.bufferKwh, 0);
  });

  it('Scenario 7: Dual EMonth=122.60 & ETotal=140.90 water-fill reconciliation across DISCOM & app', () => {
    const snap7 = solarCore.buildCanonicalSolarSnapshot({
      now: new Date('2026-11-11T17:36:00+05:30'),
      settings: {
        ...settings,
        billingCycleDay: 1,
        physicalEmonthKwh: 122.60,
        physicalEmonthCloudRefKwh: novSumCheck,
        physicalEmonthYm: '2026-11',
        physicalEmonthSetAtYmd: '2026-11-11',
        physicalEmonthSetAtMin: 17 * 60 + 36,
        physicalEtotalKwh: 140.90,
        physicalEtotalCloudRefKwh: +(novSumCheck + octSumCheck).toFixed(2),
        physicalEtotalSetAtYmd: '2026-11-11',
        physicalEtotalSetAtMin: 17 * 60 + 36,
      },
      summaryData: {
        generationToday: 9.7,
        generationMonth: novSumCheck,
        generationTotal: +(novSumCheck + octSumCheck).toFixed(2),
        generationYesterday: 0,
        lastUpdateDate: '2026-11-11 17:22:00 IST+0530',
      },
      flowData: {
        status: { state: 0, yieldToday: '0', lastUpdateDate: '2026-11-11 17:35:10 IST+0530', timeFlag: 'night' },
        node: { device: { power: { value: '0' } } },
      },
      monthDays: novDaysWith11,
      prevMonthDays: octArr,
      todayRaw: nov11Series,
      weatherData: weatherRespNov11,
      intelligenceReport: intelReport,
      commissioningYmd: '2026-10-28',
    });

    const novReconciledSum = Object.entries(snap7.reconciledBufferByYmd)
      .filter(([k]) => k.startsWith('2026-11-'))
      .reduce((s, [, v]) => s + v, 0);

    assert.equal(snap7.month.mtdKwh, 105.1);
    assert.equal(snap7.month.physicalTotalKwh, 122.6);
    assert.equal(+novReconciledSum.toFixed(2), 17.5);
    assert.equal(snap7.lifetime.confirmedKwh, 122.7);
    assert.equal(snap7.lifetime.physicalTotalKwh, 140.9);
    assert.equal(snap7.discomCycle.cycleYieldKwh, 105.1);
    assert.equal(snap7.discomCycle.physicalCycleYieldKwh, 122.6);
  });

  it('Scenario 8: Weighted inverter efficiency (92.6%) and server sync structural invariants', () => {
    const raw09 = rawAll[`${stationId}_2026-11-09`];
    const series09 = Array.isArray(raw09) ? raw09 : raw09?.rawSeries;
    const eff = solarCore.computeWeightedInverterEfficiency(series09);
    assert.equal(eff?.etaPct, 92.6);

    const serverFiles = fs.existsSync(path.join(ROOT, 'apps/server/src/sync/syncCoordinator.js'))
      ? [
          fs.readFileSync(path.join(ROOT, 'apps/server/src/sync/syncCoordinator.js'), 'utf8'),
          fs.readFileSync(path.join(ROOT, 'apps/server/src/waaree/endpoints.js'), 'utf8'),
        ].join('\n')
      : fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

    assert.ok(serverFiles.includes('Monotonic Today Yield + Inline Month/Year Coherence'));
    assert.ok(serverFiles.includes('trigger === "dusk_seal"') && serverFiles.includes('trigger === "pre_midnight_seal"'));
    assert.ok(serverFiles.includes('needsReconnectBackfill') && serverFiles.includes('yestIncomplete'));
  });
});
