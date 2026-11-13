const fs = require("fs");
const path = require("path");
const solarTruth = require("@solar-track/core/physics");
const { SETTINGS_FILE } = require("./env");

const DEFAULT_SETTINGS = {
  billingCycleDay: 1,
  lastCleanedDate: new Date(Date.now() - 14 * 86400000).toISOString(),
  cleaningEvents: [],
  plantDisplayName: null,
  commissioningDateOverride: null,
  plantLocation: {
    name: "Solar Site",
    lat: solarTruth.SOLAR_CONSTANTS.DEFAULT_LAT,
    lon: solarTruth.SOLAR_CONSTANTS.DEFAULT_LON,
  },
  arrayTiltDeg: 26.5,
  arrayAzimuthDeg: 0,
  panelTechPreset: "mono_perc",
  thermalCoeffPerC: 0.0038,
  basePrAtStc: 0.85,
  inverterEfficiency: 0.972,
  tariffPerKwh: solarTruth.SOLAR_CONSTANTS.DEFAULT_TARIFF_INR,
  systemCapacity: solarTruth.SOLAR_CONSTANTS.DEFAULT_CAPACITY_KWP,
  dcCapacityKwp: solarTruth.SOLAR_CONSTANTS.DEFAULT_CAPACITY_KWP,
  acInverterCapacityKw: solarTruth.SOLAR_CONSTANTS.DEFAULT_AC_CAPACITY_KW,
  mountingType: solarTruth.SOLAR_CONSTANTS.DEFAULT_MOUNTING_TYPE,
  roofAlbedo: solarTruth.SOLAR_CONSTANTS.DEFAULT_ALBEDO,
  dcCleanFactor: solarTruth.SOLAR_CONSTANTS.DC_CLEAN_FACTOR,
  useCalibratedTwin: true,
  kSiteOverride: null,
  inverterTareKw: null,
  inverterLinearLoss: null,
  inverterQuadLoss: null,
  physicalEtotalKwh: null,
  physicalEtotalCloudRefKwh: null,
  physicalEtotalSetAtYmd: null,
  physicalEtotalSetAtMin: null,
  physicalEmonthKwh: null,
  physicalEmonthCloudRefKwh: null,
  physicalEmonthYm: null,
  physicalEmonthSetAtYmd: null,
  physicalEmonthSetAtMin: null,
  manualGridOffDates: [],
  systemCost: solarTruth.SOLAR_CONSTANTS.DEFAULT_SYSTEM_COST_INR,
  govtSubsidyInr: 0,
  panelWashCostInr: 0,
  tariffEscalationPct: 0,
  panelDegradationPctYr: 0.55,
  co2KgPerKwh: 0.85,
  tempUnit: "C",
  packetAlertsEnabled: true,
  alertOfflineDelay: true,
  alertMorningYield: true,
  alertUnderperformance: false,
  alertVoltageSpike: true,
  offlineDelayMinutes: 30,
  underperformanceThresholdPct: 82,
  washRecommendPct: 7.0,
  rainResetDailyMm: 5.0,
  weatherCacheTtlMin: 12,
};

function clampNumber(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function isoTimestampToIstYmd(isoStr) {
  if (!isoStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(isoStr).trim())) {
    return String(isoStr).trim();
  }
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const pick = (t) => parts.find((p) => p.type === t)?.value || "01";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function normalizeCleaningEventsList(settingsObj) {
  const byYmd = new Map();
  if (Array.isArray(settingsObj.cleaningEvents)) {
    for (const ev of settingsObj.cleaningEvents) {
      const ymd = isoTimestampToIstYmd(ev?.ymd || ev?.timestampIso);
      if (!ymd) continue;
      byYmd.set(ymd, {
        ymd,
        timestampIso: ev.timestampIso || `${ymd}T07:30:00+05:30`,
        type: "manual",
        ...(ev.note ? { note: String(ev.note) } : {}),
      });
    }
  }
  if (settingsObj.lastCleanedDate) {
    const legacyYmd = isoTimestampToIstYmd(settingsObj.lastCleanedDate);
    if (legacyYmd && !byYmd.has(legacyYmd)) {
      byYmd.set(legacyYmd, {
        ymd: legacyYmd,
        timestampIso: settingsObj.lastCleanedDate,
        type: "manual",
      });
    }
  }
  return Array.from(byYmd.values()).sort((a, b) => a.ymd.localeCompare(b.ymd));
}

function normalizeSettings(raw = {}) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(raw && typeof raw === "object" ? raw : {}),
  };
  const loc = merged.plantLocation && typeof merged.plantLocation === "object" ? merged.plantLocation : {};
  const fallbackLoc = DEFAULT_SETTINGS.plantLocation;
  const lat = clampNumber(loc.lat, -90, 90, fallbackLoc.lat);
  const lon = clampNumber(loc.lon, -180, 180, fallbackLoc.lon);

  const rawDisplay = typeof merged.plantDisplayName === "string" ? merged.plantDisplayName.trim() : "";
  const rawComm = typeof merged.commissioningDateOverride === "string" ? merged.commissioningDateOverride.trim() : "";
  const rawEtotalYmd = typeof merged.physicalEtotalSetAtYmd === "string" ? merged.physicalEtotalSetAtYmd.trim() : "";
  const rawEmonthYm = typeof merged.physicalEmonthYm === "string" ? merged.physicalEmonthYm.trim() : "";
  const rawEmonthYmd = typeof merged.physicalEmonthSetAtYmd === "string" ? merged.physicalEmonthSetAtYmd.trim() : "";
  const validTech = ["mono_perc", "topcon", "hjt", "poly", "custom"].includes(merged.panelTechPreset)
    ? merged.panelTechPreset
    : "mono_perc";
  const resolvedSysCap = parseFloat(clampNumber(merged.systemCapacity, 0.1, 1000, DEFAULT_SETTINGS.systemCapacity).toFixed(2));
  const resolvedDcCap = parseFloat(
    clampNumber(merged.dcCapacityKwp ?? resolvedSysCap, 0.1, 1000, resolvedSysCap).toFixed(2)
  );
  const resolvedAcCap = parseFloat(
    clampNumber(merged.acInverterCapacityKw ?? resolvedSysCap, 0.1, 1000, resolvedSysCap).toFixed(2)
  );
  const parseOptNum = (val, min, max, decimals) => {
    if (val === null || val === undefined || val === "") return null;
    const n = Number(val);
    if (!Number.isFinite(n)) return null;
    return parseFloat(Math.min(max, Math.max(min, n)).toFixed(decimals));
  };
  const parsedEtotal = parseOptNum(merged.physicalEtotalKwh, 0, 10000000, 2);
  const validEtotal = parsedEtotal !== null && parsedEtotal > 0 ? parsedEtotal : null;
  const parsedEmonth = parseOptNum(merged.physicalEmonthKwh, 0, 1000000, 2);
  const validEmonth = parsedEmonth !== null && parsedEmonth > 0 ? parsedEmonth : null;
  const normalizedManualGridOff = Array.from(
    new Set(
      (Array.isArray(merged.manualGridOffDates) ? merged.manualGridOffDates : [])
        .map((d) => String(d || "").trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    )
  ).sort();

  const normalized = {
    billingCycleDay: Math.round(clampNumber(merged.billingCycleDay, 1, 28, DEFAULT_SETTINGS.billingCycleDay)),
    lastCleanedDate: merged.lastCleanedDate || null,
    cleaningEvents: [],
    plantDisplayName: rawDisplay ? rawDisplay.slice(0, 64) : null,
    commissioningDateOverride: /^\d{4}-\d{2}-\d{2}$/.test(rawComm) ? rawComm : null,
    plantLocation: {
      name: typeof loc.name === "string" && loc.name.trim() ? loc.name.trim().slice(0, 80) : fallbackLoc.name,
      lat,
      lon,
    },
    arrayTiltDeg: parseFloat(clampNumber(merged.arrayTiltDeg, 0, 60, DEFAULT_SETTINGS.arrayTiltDeg).toFixed(1)),
    arrayAzimuthDeg: Math.round(clampNumber(merged.arrayAzimuthDeg, -180, 180, DEFAULT_SETTINGS.arrayAzimuthDeg)),
    panelTechPreset: validTech,
    thermalCoeffPerC: parseFloat(clampNumber(merged.thermalCoeffPerC, 0.001, 0.008, DEFAULT_SETTINGS.thermalCoeffPerC).toFixed(4)),
    basePrAtStc: parseFloat(clampNumber(merged.basePrAtStc, 0.65, 0.96, DEFAULT_SETTINGS.basePrAtStc).toFixed(3)),
    inverterEfficiency: parseFloat(clampNumber(merged.inverterEfficiency, 0.8, 0.995, DEFAULT_SETTINGS.inverterEfficiency).toFixed(3)),
    tariffPerKwh: parseFloat(clampNumber(merged.tariffPerKwh, 0.5, 40, DEFAULT_SETTINGS.tariffPerKwh).toFixed(2)),
    systemCapacity: resolvedDcCap,
    dcCapacityKwp: resolvedDcCap,
    acInverterCapacityKw: resolvedAcCap,
    mountingType: merged.mountingType === "flush_rcc" ? "flush_rcc" : "open_rack",
    roofAlbedo: parseFloat(clampNumber(merged.roofAlbedo, 0.05, 0.8, DEFAULT_SETTINGS.roofAlbedo).toFixed(2)),
    dcCleanFactor: parseFloat(clampNumber(merged.dcCleanFactor, 0.75, 1.0, DEFAULT_SETTINGS.dcCleanFactor).toFixed(3)),
    useCalibratedTwin: merged.useCalibratedTwin !== false,
    kSiteOverride: parseOptNum(
      merged.kSiteOverride,
      solarTruth.SOLAR_CONSTANTS.KSITE_MIN,
      solarTruth.SOLAR_CONSTANTS.KSITE_MAX,
      3
    ),
    inverterTareKw: parseOptNum(merged.inverterTareKw, 0.005, 0.5, 4),
    inverterLinearLoss: parseOptNum(merged.inverterLinearLoss, 0, 0.15, 4),
    inverterQuadLoss: parseOptNum(merged.inverterQuadLoss, 0, 0.15, 4),
    physicalEtotalKwh: validEtotal,
    physicalEtotalCloudRefKwh: validEtotal !== null ? parseOptNum(merged.physicalEtotalCloudRefKwh, 0, 10000000, 2) : null,
    physicalEtotalSetAtYmd: validEtotal !== null && /^\d{4}-\d{2}-\d{2}$/.test(rawEtotalYmd) ? rawEtotalYmd : null,
    physicalEtotalSetAtMin: validEtotal !== null ? parseOptNum(merged.physicalEtotalSetAtMin, 0, 1440, 0) : null,
    physicalEmonthKwh: validEmonth,
    physicalEmonthCloudRefKwh: validEmonth !== null ? parseOptNum(merged.physicalEmonthCloudRefKwh, 0, 1000000, 2) : null,
    physicalEmonthYm: validEmonth !== null && /^\d{4}-\d{2}$/.test(rawEmonthYm) ? rawEmonthYm : null,
    physicalEmonthSetAtYmd: validEmonth !== null && /^\d{4}-\d{2}-\d{2}$/.test(rawEmonthYmd) ? rawEmonthYmd : null,
    physicalEmonthSetAtMin: validEmonth !== null ? parseOptNum(merged.physicalEmonthSetAtMin, 0, 1440, 0) : null,
    manualGridOffDates: normalizedManualGridOff,
    systemCost: Math.round(clampNumber(merged.systemCost, 1000, 100000000, DEFAULT_SETTINGS.systemCost)),
    govtSubsidyInr: Math.round(clampNumber(merged.govtSubsidyInr, 0, 50000000, DEFAULT_SETTINGS.govtSubsidyInr)),
    panelWashCostInr: Math.round(clampNumber(merged.panelWashCostInr, 0, 50000, DEFAULT_SETTINGS.panelWashCostInr)),
    tariffEscalationPct: parseFloat(clampNumber(merged.tariffEscalationPct, 0, 20, DEFAULT_SETTINGS.tariffEscalationPct).toFixed(1)),
    panelDegradationPctYr: parseFloat(clampNumber(merged.panelDegradationPctYr, 0, 3.0, DEFAULT_SETTINGS.panelDegradationPctYr).toFixed(2)),
    co2KgPerKwh: parseFloat(clampNumber(merged.co2KgPerKwh, 0.2, 1.5, DEFAULT_SETTINGS.co2KgPerKwh).toFixed(2)),
    tempUnit: merged.tempUnit === "F" ? "F" : "C",
    packetAlertsEnabled: Boolean(merged.packetAlertsEnabled),
    alertOfflineDelay: Boolean(merged.alertOfflineDelay),
    alertMorningYield: Boolean(merged.alertMorningYield),
    alertUnderperformance: Boolean(merged.alertUnderperformance),
    alertVoltageSpike: Boolean(merged.alertVoltageSpike),
    offlineDelayMinutes: Math.round(clampNumber(merged.offlineDelayMinutes, 5, 240, DEFAULT_SETTINGS.offlineDelayMinutes)),
    underperformanceThresholdPct: Math.round(clampNumber(merged.underperformanceThresholdPct, 50, 99, DEFAULT_SETTINGS.underperformanceThresholdPct)),
    washRecommendPct: parseFloat(clampNumber(merged.washRecommendPct, 1, 25, DEFAULT_SETTINGS.washRecommendPct).toFixed(1)),
    rainResetDailyMm: parseFloat(clampNumber(merged.rainResetDailyMm, 0.5, 30, DEFAULT_SETTINGS.rainResetDailyMm).toFixed(1)),
    weatherCacheTtlMin: Math.round(clampNumber(merged.weatherCacheTtlMin, 5, 60, DEFAULT_SETTINGS.weatherCacheTtlMin)),
  };

  normalized.cleaningEvents = normalizeCleaningEventsList(merged);
  if (normalized.cleaningEvents.length > 0) {
    const latest = normalized.cleaningEvents[normalized.cleaningEvents.length - 1];
    normalized.lastCleanedDate = latest.timestampIso || `${latest.ymd}T07:30:00+05:30`;
  } else {
    normalized.lastCleanedDate = raw?.lastCleanedDate === null ? null : merged.lastCleanedDate || null;
  }
  return normalized;
}

function buildPhysicsArgsFromSettings(settings, fallbackCap = solarTruth.SOLAR_CONSTANTS.DEFAULT_CAPACITY_KWP) {
  const dcCapacityKwp = clampNumber(settings?.dcCapacityKwp ?? settings?.systemCapacity, 0.1, 1000, fallbackCap);
  const acInverterCapacityKw = clampNumber(
    settings?.acInverterCapacityKw ?? settings?.systemCapacity,
    0.1,
    1000,
    fallbackCap
  );
  return {
    dcCapacityKwp: parseFloat(dcCapacityKwp.toFixed(2)),
    acInverterCapacityKw: parseFloat(acInverterCapacityKw.toFixed(2)),
    arrayTiltDeg: clampNumber(settings?.arrayTiltDeg, 0, 60, 26.5),
    arrayAzimuthDeg: Math.round(clampNumber(settings?.arrayAzimuthDeg, -180, 180, 0)),
    mountingType: settings?.mountingType === "flush_rcc" ? "flush_rcc" : "open_rack",
    roofAlbedo: clampNumber(settings?.roofAlbedo, 0.05, 0.8, solarTruth.SOLAR_CONSTANTS.DEFAULT_ALBEDO),
    dcCleanFactor: clampNumber(settings?.dcCleanFactor, 0.75, 1.0, solarTruth.SOLAR_CONSTANTS.DC_CLEAN_FACTOR),
    thermalCoeffPerC: clampNumber(settings?.thermalCoeffPerC, 0.001, 0.008, 0.0038),
    basePrAtStc: clampNumber(settings?.basePrAtStc, 0.65, 0.96, 0.85),
    inverterEfficiency: clampNumber(settings?.inverterEfficiency, 0.8, 0.995, 0.972),
    useCalibratedTwin: settings?.useCalibratedTwin !== false,
    kSiteOverride:
      settings?.kSiteOverride != null && Number.isFinite(Number(settings.kSiteOverride))
        ? clampNumber(settings.kSiteOverride, solarTruth.SOLAR_CONSTANTS.KSITE_MIN, solarTruth.SOLAR_CONSTANTS.KSITE_MAX, 1.0)
        : null,
    inverterTareKw:
      settings?.inverterTareKw != null && Number.isFinite(Number(settings.inverterTareKw))
        ? clampNumber(settings.inverterTareKw, 0.005, 0.5, solarTruth.SOLAR_CONSTANTS.DEFAULT_INV_TARE_KW)
        : null,
    inverterLinearLoss:
      settings?.inverterLinearLoss != null && Number.isFinite(Number(settings.inverterLinearLoss))
        ? clampNumber(settings.inverterLinearLoss, 0, 0.15, solarTruth.SOLAR_CONSTANTS.DEFAULT_INV_LINEAR_LOSS)
        : null,
    inverterQuadLoss:
      settings?.inverterQuadLoss != null && Number.isFinite(Number(settings.inverterQuadLoss))
        ? clampNumber(settings.inverterQuadLoss, 0, 0.15, solarTruth.SOLAR_CONSTANTS.DEFAULT_INV_QUAD_LOSS)
        : null,
  };
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return normalizeSettings(JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")));
    }
  } catch (e) {
    console.error("[Settings] Error reading settings.json:", e.message);
  }
  return normalizeSettings(DEFAULT_SETTINGS);
}

function saveSettings(settings) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error("[Settings] Error writing settings.json:", e.message);
  }
}

module.exports = {
  DEFAULT_SETTINGS,
  clampNumber,
  isoTimestampToIstYmd,
  normalizeCleaningEventsList,
  normalizeSettings,
  buildPhysicsArgsFromSettings,
  loadSettings,
  saveSettings,
};
