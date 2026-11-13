const solarTruth = require("@solar-track/core/physics");
const {
  DEFAULT_SETTINGS,
  clampNumber,
  normalizeSettings,
  loadSettings,
  saveSettings,
} = require("../config/settingsStore");
const {
  flowMemoryCache,
  lastKnownFallbackCache,
  intelligenceCache,
  inFlightAnnualBaselines,
  getWeatherCache,
  clearModelCaches,
  isBackoffActive,
  getBackoffRemainingSec,
  getBackoffReason,
} = require("../storage/memoryCaches");
const { getISTDateParts, getISTDate } = require("../time/istClock");
const { getPrimaryStationAndToken } = require("../waaree/accountsStore");
const { fetchOpenMeteoWeather } = require("../weather/openMeteoClient");
const {
  ensureHistoricalAtmosphereBackfill,
  fetchOrGetAnnualMonthlyBaseline,
} = require("../weather/historicalBackfill");
const { broadcastSettingsUpdated } = require("../sync/sseBroker");
const { runSimultaneousSync } = require("../sync/syncCoordinator");
const { sendJson, readJsonBody } = require("./httpUtils");

/**
 * Handle `/api/dashboard/init`, `/api/proxy/status`, `/api/settings*`, and `/api/cache/refresh`.
 * @returns {Promise<boolean>}
 */
async function handleSettingsRoutes(req, res, reqUrl) {
  if (reqUrl.pathname === "/api/dashboard/init" && req.method === "GET") {
    const s = loadSettings();
    const weatherCache = getWeatherCache();
    sendJson(res, 200, {
      errno: 0,
      capabilities: {
        hasSmartMeter: false,
        hasWeatherSensor: false,
        hasBattery: false,
      },
      defaultTariff: Number(s.tariffPerKwh) || solarTruth.SOLAR_CONSTANTS.DEFAULT_TARIFF_INR,
      systemCapacity:
        Number(s.dcCapacityKwp ?? s.systemCapacity) ||
        solarTruth.SOLAR_CONSTANTS.DEFAULT_CAPACITY_KWP,
      dcCapacityKwp:
        Number(s.dcCapacityKwp ?? s.systemCapacity) ||
        solarTruth.SOLAR_CONSTANTS.DEFAULT_CAPACITY_KWP,
      acInverterCapacityKw:
        Number(s.acInverterCapacityKw ?? s.systemCapacity) ||
        solarTruth.SOLAR_CONSTANTS.DEFAULT_AC_CAPACITY_KW,
      currency: "INR",
      timezone: "Asia/Kolkata",
      proxyRulesActive: {
        rule1_tokenCached: true,
        rule2_flowCacheTTLSeconds: 30,
        rule3_mobileHeaders: true,
        rule4_sequentialStaggerMs: 400,
        rule5_autoBackoffMinutes: 10,
      },
      backoffActive: isBackoffActive(),
      backoffRemainingSec: getBackoffRemainingSec(),
      settings: s,
      weatherCacheMeta: {
        cachedAtIso: weatherCache.timestamp ? new Date(weatherCache.timestamp).toISOString() : null,
        dateYmd: weatherCache.dateYmd || null,
        ttlMin: Number(s.weatherCacheTtlMin) || 12,
      },
    });
    return true;
  }

  if (reqUrl.pathname === "/api/proxy/status" && req.method === "GET") {
    sendJson(res, 200, {
      errno: 0,
      rules: {
        rule1_tokenCaching:
          "Active (Stored in accounts.json/token.txt, never refreshed per request)",
        rule2_flowCache: "Active (30-second in-memory TTL)",
        rule3_mobileHeaders: "Active (Dalvik/Android 14 Pixel 8 Pro com.odm.waaree v1.0.3)",
        rule4_sequentialQueue: "Active (Minimum 400ms stagger, no Promise.all bursts)",
        rule5_autoBackoff:
          "Active (10-minute cooldown on 429/upstream errors with last-known cache)",
      },
      backoffActive: isBackoffActive(),
      backoffRemainingSec: getBackoffRemainingSec(),
      backoffReason: getBackoffReason(),
      activeFlowCachedStations: Array.from(flowMemoryCache.keys()),
      lastKnownCachedEndpointsCount: lastKnownFallbackCache.size,
      systemTimeIST: getISTDate().toISOString(),
    });
    return true;
  }

  if (reqUrl.pathname === "/api/settings" && req.method === "GET") {
    sendJson(res, 200, { errno: 0, settings: loadSettings() });
    return true;
  }

  if (reqUrl.pathname === "/api/settings" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      if (payload && typeof payload === "object") {
        if (payload.dcCapacityKwp !== undefined && payload.systemCapacity === undefined) {
          payload.systemCapacity = payload.dcCapacityKwp;
        } else if (payload.systemCapacity !== undefined && payload.dcCapacityKwp === undefined) {
          payload.dcCapacityKwp = payload.systemCapacity;
        }
      }
      const current = loadSettings();
      const updated = normalizeSettings({ ...current, ...payload });
      const geometryOrLocationChanged =
        (Boolean(payload.plantLocation) &&
          (Math.abs(updated.plantLocation.lat - current.plantLocation.lat) > 0.0001 ||
            Math.abs(updated.plantLocation.lon - current.plantLocation.lon) > 0.0001)) ||
        Math.abs(updated.arrayTiltDeg - current.arrayTiltDeg) > 0.05 ||
        Math.abs(updated.arrayAzimuthDeg - current.arrayAzimuthDeg) > 0.5;
      const modelChanged =
        geometryOrLocationChanged ||
        Math.abs(updated.dcCapacityKwp - current.dcCapacityKwp) > 0.01 ||
        Math.abs(updated.acInverterCapacityKw - current.acInverterCapacityKw) > 0.01 ||
        updated.mountingType !== current.mountingType ||
        Math.abs(updated.roofAlbedo - current.roofAlbedo) > 0.005 ||
        Math.abs(updated.dcCleanFactor - current.dcCleanFactor) > 0.0005 ||
        updated.useCalibratedTwin !== current.useCalibratedTwin ||
        updated.kSiteOverride !== current.kSiteOverride ||
        updated.inverterTareKw !== current.inverterTareKw ||
        updated.inverterLinearLoss !== current.inverterLinearLoss ||
        updated.inverterQuadLoss !== current.inverterQuadLoss ||
        Math.abs(updated.thermalCoeffPerC - current.thermalCoeffPerC) > 0.00001 ||
        Math.abs(updated.basePrAtStc - current.basePrAtStc) > 0.0005 ||
        Math.abs(updated.inverterEfficiency - current.inverterEfficiency) > 0.0005 ||
        updated.panelTechPreset !== current.panelTechPreset ||
        updated.commissioningDateOverride !== current.commissioningDateOverride ||
        Math.abs(updated.washRecommendPct - current.washRecommendPct) > 0.05 ||
        Math.abs(updated.rainResetDailyMm - current.rainResetDailyMm) > 0.05 ||
        updated.weatherCacheTtlMin !== current.weatherCacheTtlMin;

      if (geometryOrLocationChanged) {
        clearModelCaches({ clearWeather: true });
      } else if (modelChanged) {
        inFlightAnnualBaselines.clear();
      }

      saveSettings(updated);
      intelligenceCache.clear();
      broadcastSettingsUpdated(updated, { geometryOrLocationChanged });
      setImmediate(() => {
        runSimultaneousSync(null, {
          force: geometryOrLocationChanged,
          trigger: "settings_updated",
        }).catch(() => {});
      });
      sendJson(res, 200, { errno: 0, settings: updated });
    } catch (e) {
      sendJson(res, 500, { errno: -1, error: e.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/settings/reset" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const current = loadSettings();
      const preserveLocation = payload.preserveLocation !== false && !payload.fullReset;
      const preserveCleaning = payload.preserveCleaning !== false && !payload.fullReset;
      const resetBase = normalizeSettings({
        ...DEFAULT_SETTINGS,
        plantLocation: preserveLocation ? current.plantLocation : DEFAULT_SETTINGS.plantLocation,
        cleaningEvents: preserveCleaning ? current.cleaningEvents : [],
        lastCleanedDate: preserveCleaning ? current.lastCleanedDate : null,
      });
      clearModelCaches({ clearWeather: true });
      saveSettings(resetBase);
      broadcastSettingsUpdated(resetBase, { geometryOrLocationChanged: true });
      setImmediate(() => {
        runSimultaneousSync(null, { force: true, trigger: "settings_reset" }).catch(() => {});
      });
      sendJson(res, 200, { errno: 0, settings: resetBase });
    } catch (e) {
      sendJson(res, 500, { errno: -1, error: e.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/cache/refresh" && req.method === "POST") {
    try {
      const settings = loadSettings();
      const lat = parseFloat(settings.plantLocation?.lat ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LAT);
      const lon = parseFloat(settings.plantLocation?.lon ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LON);
      const tilt = clampNumber(settings.arrayTiltDeg, 0, 60, 26.5);
      const azimuth = clampNumber(settings.arrayAzimuthDeg, -180, 180, 0);
      const physicsOverrides = {
        thermalCoeffPerC: settings.thermalCoeffPerC,
        basePrAtStc: settings.basePrAtStc,
        inverterEfficiency: settings.inverterEfficiency,
      };
      clearModelCaches({ clearWeather: true });
      const [weather, baseline] = await Promise.all([
        fetchOpenMeteoWeather(lat, lon, {
          force: true,
          tilt,
          azimuth,
          dayTtlMin: settings.weatherCacheTtlMin,
        }),
        fetchOrGetAnnualMonthlyBaseline(lat, lon, true, tilt, azimuth, physicsOverrides),
      ]);
      await ensureHistoricalAtmosphereBackfill(
        lat,
        lon,
        getPrimaryStationAndToken(null).commissioningYmd || "2026-10-28",
        true,
        tilt,
        azimuth
      ).catch(() => {});
      const primary = getPrimaryStationAndToken();
      if (primary.stationId) {
        runSimultaneousSync(primary.stationId, { force: true, trigger: "cache_refresh" }).catch(
          () => {}
        );
      }
      sendJson(res, 200, {
        errno: 0,
        weatherAvailable: Boolean(weather),
        baselineMonths: baseline?.months?.length || 0,
        archivePeriod: baseline ? `${baseline.startYmd} -> ${baseline.endYmd}` : null,
        refreshedAtIso: new Date().toISOString(),
      });
    } catch (e) {
      sendJson(res, 500, { errno: -1, error: e.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/settings/clean-panels" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const current = loadSettings();
      const istTodayYmd = getISTDateParts().ymd;
      const requestedYmd =
        typeof payload.dateYmd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.dateYmd)
          ? payload.dateYmd
          : istTodayYmd;
      const clampedYmd = requestedYmd > istTodayYmd ? istTodayYmd : requestedYmd;
      const action = payload.action === "remove" ? "remove" : "add";

      let events = Array.isArray(current.cleaningEvents) ? [...current.cleaningEvents] : [];
      if (action === "remove") {
        events = events.filter((ev) => ev.ymd !== clampedYmd);
      } else {
        const tsIso =
          clampedYmd === istTodayYmd
            ? new Date().toISOString()
            : `${clampedYmd}T07:30:00+05:30`;
        events = events.filter((ev) => ev.ymd !== clampedYmd);
        events.push({
          ymd: clampedYmd,
          timestampIso: tsIso,
          type: "manual",
          ...(payload.note ? { note: String(payload.note) } : {}),
        });
      }

      events.sort((a, b) => a.ymd.localeCompare(b.ymd));
      current.cleaningEvents = events;
      if (events.length > 0) {
        current.lastCleanedDate =
          events[events.length - 1].timestampIso ||
          `${events[events.length - 1].ymd}T07:30:00+05:30`;
      } else {
        current.lastCleanedDate = null;
      }

      saveSettings(current);
      intelligenceCache.clear();
      broadcastSettingsUpdated(current);
      setImmediate(() => {
        runSimultaneousSync(null, { force: false, trigger: "wash_logged" }).catch(() => {});
      });
      sendJson(res, 200, {
        errno: 0,
        message:
          action === "remove"
            ? `Removed wash log for ${clampedYmd}`
            : `Panels marked clean on ${clampedYmd}`,
        cleanedYmd: clampedYmd,
        lastCleanedDate: current.lastCleanedDate || null,
        cleaningEvents: current.cleaningEvents,
      });
    } catch (e) {
      sendJson(res, 400, { errno: -1, error: e.message });
    }
    return true;
  }

  return false;
}

module.exports = {
  handleSettingsRoutes,
};
