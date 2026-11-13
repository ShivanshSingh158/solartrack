const solarTruth = require("@solar-track/core/physics");
const {
  clampNumber,
  loadSettings,
  buildPhysicsArgsFromSettings,
} = require("../config/settingsStore");
const { loadHistoryCache } = require("../storage/jsonFileStore");
const { stationSyncState, isBackoffActive } = require("../storage/memoryCaches");
const { getISTClockSnapshot } = require("../time/istClock");
const { getPrimaryStationAndToken } = require("../waaree/accountsStore");
const {
  fetchWaareeMonthReportInternal,
  fetchWaareeRawDayInternal,
  extractMonthlyDays,
} = require("../waaree/endpoints");
const {
  fetchOpenMeteoDay,
  fetchOrGetAnnualMonthlyBaseline,
} = require("../weather/historicalBackfill");
const { buildSolarWeatherPayload } = require("../weather/solarWeatherService");
const { reverseGeocode, searchLocation } = require("../weather/geocoding");
const { computeAndServeSolarIntelligence } = require("../intelligence/intelligenceService");
const { sendJson } = require("./httpUtils");

/**
 * Handle `/api/solar-intelligence`, `/api/weather/solar`, `/api/solar-weather`,
 * `/api/annual-solar-baseline`, `/api/day-comparison`, and `/api/location/lookup`.
 * @returns {Promise<boolean>}
 */
async function handleWeatherRoutes(req, res, reqUrl) {
  if (reqUrl.pathname === "/api/solar-intelligence" && req.method === "GET") {
    const stationId = reqUrl.searchParams.get("stationID") || null;
    const force = reqUrl.searchParams.get("force") === "true";
    try {
      const payload = await computeAndServeSolarIntelligence(stationId, { force });
      sendJson(res, 200, payload);
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (
    (reqUrl.pathname === "/api/weather/solar" || reqUrl.pathname === "/api/solar-weather") &&
    req.method === "GET"
  ) {
    const settings = loadSettings();
    const latParam = reqUrl.searchParams.get("lat");
    const lonParam = reqUrl.searchParams.get("lon");
    const force = reqUrl.searchParams.get("force") === "true";
    const weatherPayload = await buildSolarWeatherPayload(settings, {
      force,
      latOverride: latParam ? parseFloat(latParam) : null,
      lonOverride: lonParam ? parseFloat(lonParam) : null,
    });
    sendJson(res, 200, weatherPayload);
    return true;
  }

  if (reqUrl.pathname === "/api/annual-solar-baseline" && req.method === "GET") {
    const settings = loadSettings();
    const latParam = reqUrl.searchParams.get("lat");
    const lonParam = reqUrl.searchParams.get("lon");
    const force = reqUrl.searchParams.get("force") === "true";
    const lat = latParam
      ? parseFloat(latParam)
      : parseFloat(settings.plantLocation?.lat ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LAT);
    const lon = lonParam
      ? parseFloat(lonParam)
      : parseFloat(settings.plantLocation?.lon ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LON);
    const tilt = clampNumber(settings.arrayTiltDeg, 0, 60, 26.5);
    const azimuth = clampNumber(settings.arrayAzimuthDeg, -180, 180, 0);
    const physicsOverrides = {
      thermalCoeffPerC: settings.thermalCoeffPerC,
      basePrAtStc: settings.basePrAtStc,
      inverterEfficiency: settings.inverterEfficiency,
    };
    const baseline = await fetchOrGetAnnualMonthlyBaseline(
      lat,
      lon,
      force,
      tilt,
      azimuth,
      physicsOverrides
    );
    sendJson(res, 200, { errno: 0, baseline: baseline || null });
    return true;
  }

  if (reqUrl.pathname === "/api/day-comparison" && req.method === "GET") {
    try {
      const requestedStation = reqUrl.searchParams.get("stationID") || null;
      const resolved = getPrimaryStationAndToken(requestedStation);
      const stationId = resolved.stationId;
      const token = req.headers.token || resolved.token;
      const settings = loadSettings();
      const istClock = getISTClockSnapshot();
      const minDateYmd = resolved.commissioningYmd || "2026-10-28";
      const maxDateYmd = istClock.ymd;
      const force = reqUrl.searchParams.get("force") === "true";
      const calendarOnly = reqUrl.searchParams.get("calendarOnly") === "true";

      let targetYmd = reqUrl.searchParams.get("date") || istClock.ymd;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetYmd)) targetYmd = istClock.ymd;
      if (targetYmd < minDateYmd) targetYmd = minDateYmd;
      if (targetYmd > maxDateYmd) targetYmd = maxDateYmd;

      const [tYear, tMonth, tDay] = targetYmd.split("-").map((n) => parseInt(n, 10));
      let calYm = reqUrl.searchParams.get("calendarMonth") || targetYmd.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(calYm)) calYm = targetYmd.slice(0, 7);
      const minYm = minDateYmd.slice(0, 7);
      const maxYm = maxDateYmd.slice(0, 7);
      if (calYm < minYm) calYm = minYm;
      if (calYm > maxYm) calYm = maxYm;
      const [cYear, cMonth] = calYm.split("-").map((n) => parseInt(n, 10));

      const snap = stationId ? stationSyncState.get(stationId)?.lastSnapshot : null;
      const pad2 = (n) => String(n).padStart(2, "0");

      const loadMonthDaysFor = async (y, m) => {
        if (!stationId) return [];
        if (
          !force &&
          y === istClock.year &&
          m === istClock.month &&
          Array.isArray(snap?.waaree?.monthlyDays) &&
          snap.waaree.monthlyDays.length > 0
        ) {
          return snap.waaree.monthlyDays;
        }
        if (!token || isBackoffActive()) {
          const cached = loadHistoryCache()[`${stationId}_month_${y}_${m}`];
          return cached ? extractMonthlyDays(cached) : [];
        }
        const rep = await fetchWaareeMonthReportInternal(stationId, y, m, token, false);
        return extractMonthlyDays(rep);
      };

      const calDaysRaw = await loadMonthDaysFor(cYear, cMonth);
      const calendarDays = calDaysRaw
        .map((d) => ({
          ymd: `${cYear}-${pad2(cMonth)}-${pad2(d.index)}`,
          day: d.index,
          kwh: parseFloat((Number(d.value) || 0).toFixed(2)),
        }))
        .sort((a, b) => a.day - b.day);

      if (calendarOnly) {
        sendJson(res, 200, {
          errno: 0,
          stationId,
          minDateYmd,
          maxDateYmd,
          calendar: { ym: calYm, days: calendarDays },
          inBackoff: isBackoffActive(),
        });
        return true;
      }

      const lat = parseFloat(settings.plantLocation?.lat ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LAT);
      const lon = parseFloat(settings.plantLocation?.lon ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LON);
      const phys = buildPhysicsArgsFromSettings(settings, parseFloat(resolved.capacity) || 3.0);
      const capacityKwp = phys.dcCapacityKwp;

      const weatherPromise = fetchOpenMeteoDay(lat, lon, targetYmd, force);
      const targetMonthDaysPromise =
        cYear === tYear && cMonth === tMonth
          ? Promise.resolve(calDaysRaw)
          : loadMonthDaysFor(tYear, tMonth);

      let rawPromise;
      const isToday = targetYmd === istClock.ymd;
      const isYesterday = targetYmd === istClock.yesterdayYmd;
      if (!force && isToday && Array.isArray(snap?.waaree?.todayRaw) && snap.waaree.todayRaw.length > 0) {
        rawPromise = Promise.resolve(snap.waaree.todayRaw);
      } else if (
        !force &&
        isYesterday &&
        Array.isArray(snap?.waaree?.yesterdayRaw) &&
        snap.waaree.yesterdayRaw.length > 0
      ) {
        rawPromise = Promise.resolve(snap.waaree.yesterdayRaw);
      } else if (
        !force &&
        snap?.waaree?.lastSyncedDay?.ymd === targetYmd &&
        Array.isArray(snap.waaree.lastSyncedDay.raw) &&
        snap.waaree.lastSyncedDay.raw.length > 0
      ) {
        rawPromise = Promise.resolve(snap.waaree.lastSyncedDay.raw);
      } else if (stationId) {
        rawPromise = fetchWaareeRawDayInternal(
          stationId,
          { year: tYear, month: tMonth, day: tDay },
          targetYmd,
          token || "",
          targetYmd < istClock.ymd
        );
      } else {
        rawPromise = Promise.resolve([]);
      }

      const [weatherDay, targetMonthDays, rawSeries] = await Promise.all([
        weatherPromise,
        targetMonthDaysPromise,
        rawPromise,
      ]);

      const eepromEntry = targetMonthDays.find((d) => Number(d.index) === tDay);
      let eepromKwh = eepromEntry ? parseFloat((Number(eepromEntry.value) || 0).toFixed(2)) : 0;
      if (isToday && (snap?.waaree?.summary?.generationToday || 0) > eepromKwh) {
        eepromKwh = parseFloat((Number(snap.waaree.summary.generationToday) || 0).toFixed(2));
      }

      const genSeries = Array.isArray(rawSeries)
        ? rawSeries.find((s) => s.variable === "generationPower") ||
          rawSeries.find((s) => s.variable === "pvPower")
        : null;
      const hasRawCurve = Boolean(
        genSeries && Array.isArray(genSeries.data) && genSeries.data.length > 0
      );

      sendJson(res, 200, {
        errno: 0,
        stationId,
        commissioningYmd: minDateYmd,
        minDateYmd,
        maxDateYmd,
        dateYmd: targetYmd,
        isToday,
        isPastDate: targetYmd < istClock.ymd,
        capacityKwp,
        dcCapacityKwp: phys.dcCapacityKwp,
        acInverterCapacityKw: phys.acInverterCapacityKw,
        location: settings.plantLocation,
        weather: weatherDay,
        waaree: {
          eepromKwh,
          hasEeprom: eepromKwh > 0.05,
          rawSeries: Array.isArray(rawSeries) ? rawSeries : [],
          hasRawCurve,
        },
        calendar: {
          ym: calYm,
          days: calendarDays,
        },
        inBackoff: isBackoffActive(),
        fetchedAtIso: new Date().toISOString(),
      });
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/location/lookup" && req.method === "GET") {
    const lat = reqUrl.searchParams.get("lat");
    const lon = reqUrl.searchParams.get("lon");
    const query = reqUrl.searchParams.get("q");

    let resultPromise = null;
    if (lat && lon) {
      resultPromise = reverseGeocode(parseFloat(lat), parseFloat(lon));
    } else if (query) {
      resultPromise = searchLocation(query);
    } else {
      const settings = loadSettings();
      resultPromise = Promise.resolve(settings.plantLocation);
    }

    const loc = await resultPromise;
    sendJson(res, 200, { errno: 0, location: loc });
    return true;
  }

  return false;
}

module.exports = {
  handleWeatherRoutes,
};
