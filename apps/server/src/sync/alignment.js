const solarTruth = require("@solar-track/core/physics");
const { buildPhysicsArgsFromSettings, loadSettings } = require("../config/settingsStore");
const { getISTClockSnapshot } = require("../time/istClock");
const { summarizeRawSeries } = require("../waaree/endpoints");

/**
 * Extract instantaneous AC power (kW) from Waaree `/flow/info` response.
 */
function extractFlowAcPowerKw(flowData) {
  const res = flowData?.result || flowData || {};
  const acDevice = parseFloat(res?.node?.device?.power?.value) || 0;
  const acGenNode = parseFloat(res?.node?.gen?.power?.value) || 0;
  const acGenTop = parseFloat(res?.power?.generation) || 0;
  const dcSolar = parseFloat(res?.node?.solar?.power?.value) || 0;
  const dcTop = parseFloat(res?.power?.pv) || 0;
  if (acDevice > 0) return acDevice;
  if (acGenNode > 0) return acGenNode;
  if (acGenTop > 0) return acGenTop;
  return Math.max(0, dcSolar, dcTop);
}

/**
 * Extract instantaneous DC PV input power (kW) from Waaree `/flow/info` response.
 */
function extractFlowDcPowerKw(flowData) {
  const res = flowData?.result || flowData || {};
  return Math.max(
    0,
    parseFloat(res?.node?.solar?.power?.value) || 0,
    parseFloat(res?.power?.pv) || 0
  );
}

/**
 * Backward-compatible alias for AC inverter power extraction.
 */
function extractFlowPowerKw(flowData) {
  return extractFlowAcPowerKw(flowData);
}

/**
 * Parse a relative freshness label (e.g., "Just now", "5 minutes ago", "2 hours ago")
 * into minutes elapsed.
 */
function extractRelativeMinutesAgo(str) {
  const s = String(str || "").toLowerCase();
  if (!s) return null;
  if (/just now/i.test(s)) return 0;
  const d = s.match(/(\d+)\s*(?:day|days|d)\b/);
  const h = s.match(/(\d+)\s*(?:hour|hours|hr|hrs|h)\b/);
  const m = s.match(/(\d+)\s*(?:minute|minutes|min|mins|m)\b/);
  if (!d && !h && !m) return null;
  return (
    (d ? parseInt(d[1], 10) * 1440 : 0) +
    (h ? parseInt(h[1], 10) * 60 : 0) +
    (m ? parseInt(m[1], 10) : 0)
  );
}

/**
 * Determine whether a Waaree dongle status string represents stale/offline hardware (>=30 min).
 */
function isStaleStatusString(str) {
  const mins = extractRelativeMinutesAgo(str);
  if (mins !== null) return mins >= 30;
  return !str || /offline/i.test(String(str));
}

/**
 * Detect whether the inverter transitioned from stale/offline state into live online state,
 * suppressing wall-clock aging ticks such as "1 minute ago" -> "2 minutes ago".
 */
function didInverterTransitionOnline(prevLastUpdate, nextLastUpdate, prevState, nextState) {
  if (!nextLastUpdate || isStaleStatusString(nextLastUpdate)) return false;
  if (prevState === 0 && nextState && nextState !== 0) return true;
  if (isStaleStatusString(prevLastUpdate)) return true;
  const prevMins = extractRelativeMinutesAgo(prevLastUpdate);
  const nextMins = extractRelativeMinutesAgo(nextLastUpdate);
  if (prevMins !== null || nextMins !== null) return false;
  return prevLastUpdate !== nextLastUpdate;
}

/**
 * Detect whether relative dongle age reset downward (indicating a fresh cloud upload packet).
 */
function didDongleAgeReset(prevLastUpdate, nextLastUpdate) {
  const prevMins = extractRelativeMinutesAgo(prevLastUpdate);
  const nextMins = extractRelativeMinutesAgo(nextLastUpdate);
  if (prevMins !== null && nextMins !== null) {
    return nextMins < prevMins;
  }
  return false;
}

/**
 * Compute comparable telemetry fingerprint across live flow, curve points, and daily/monthly bars.
 */
function computeWaareeFingerprint({
  flowData,
  monthlyDays,
  todayRaw,
  yesterdayRaw,
  istClock,
  monthTotal,
  lifetimeTotal,
  yesterdayMonthlyVal = 0,
}) {
  const status = flowData?.result?.status || {};
  const livePowerKw = extractFlowAcPowerKw(flowData);
  const liveDcPowerKw = extractFlowDcPowerKw(flowData);
  const yieldToday = parseFloat(status.yieldToday) || 0;
  const lastUpdateDate = status.lastUpdateDate || "Updated";
  const statusState = status.state ?? null;
  const todayStats = summarizeRawSeries(todayRaw);
  const yestStats = summarizeRawSeries(yesterdayRaw);
  const yestDayEntry = monthlyDays.find((d) => d.index === istClock.yesterdayDay);
  const resolvedYestVal =
    istClock.yesterdayMonth === istClock.month
      ? yestDayEntry
        ? yestDayEntry.value
        : 0
      : yesterdayMonthlyVal;
  return {
    istYmd: istClock.ymd,
    livePowerKw: parseFloat(livePowerKw.toFixed(3)),
    liveDcPowerKw: parseFloat(liveDcPowerKw.toFixed(3)),
    yieldToday: parseFloat(yieldToday.toFixed(2)),
    lastUpdateDate,
    statusState,
    monthTotal: parseFloat((monthTotal || 0).toFixed(2)),
    lifetimeTotal: parseFloat((lifetimeTotal || 0).toFixed(2)),
    yesterdayValue: resolvedYestVal,
    todayGenCount: todayStats.count,
    todayLastTime: todayStats.lastTime,
    yesterdayGenCount: yestStats.count,
    yesterdayLastTime: yestStats.lastTime,
  };
}

/**
 * Compute instantaneous real-vs-physics alignment metrics at the current IST minute.
 */
function computeLiveAlignment(
  weatherPayload,
  realKw,
  capacity = 3.0,
  istClock = getISTClockSnapshot(),
  dcKw = 0,
  physicsOverrides = null
) {
  const realKwNow = parseFloat((Number(realKw) || 0).toFixed(2));
  const liveDcPowerKw = parseFloat((Number(dcKw) || 0).toFixed(2));
  const nowMin = Number.isFinite(Number(istClock?.minutesSinceMidnight))
    ? Number(istClock.minutesSinceMidnight)
    : 720;

  const settings = physicsOverrides ? null : loadSettings();
  const basePhys = settings ? buildPhysicsArgsFromSettings(settings, capacity) : {};
  const siteCal = weatherPayload?.siteCalibration || null;
  const effOverrides = {
    ...basePhys,
    ...(siteCal
      ? {
          kSite: siteCal.kSiteApplied,
          inverterLossCoeffs: siteCal.inverterCoeffs,
          hourlyShadeFactors: siteCal.enabled ? siteCal.hourlyShadeFactors : null,
          arrayAzimuthDeg:
            siteCal.enabled && typeof siteCal.effectiveAzimuthDeg === "number"
              ? siteCal.effectiveAzimuthDeg
              : basePhys.arrayAzimuthDeg,
          gtiReferenceAzimuthDeg:
            weatherPayload?.location?.azimuthDegrees ??
            weatherPayload?.azimuthDegrees ??
            basePhys.arrayAzimuthDeg,
        }
      : {}),
    ...(physicsOverrides || {}),
  };
  const dcCap = Number(effOverrides.dcCapacityKwp) || Number(capacity) || 3.0;
  const surfaceLossPct = Number(weatherPayload?.todayForecast?.currentSurfaceLossPct) || 0;

  const todayPhysics = solarTruth.computeTodayPhysicsAtMinute(
    weatherPayload,
    dcCap,
    nowMin,
    surfaceLossPct,
    effOverrides
  );
  const calcFullDayKwh = todayPhysics.model.targetDailyModelKwh;
  const calcKwNow = todayPhysics.isDaylightWindow ? todayPhysics.current.kw : 0;
  const calcCumKwhNow = todayPhysics.current.cumKwh;

  const deltaKw = parseFloat((realKwNow - calcKwNow).toFixed(2));
  const capturePct =
    calcKwNow > 0.05 ? Math.round((realKwNow / calcKwNow) * 100) : realKwNow > 0 ? 100 : null;
  return { calcKwNow, calcCumKwhNow, calcFullDayKwh, realKwNow, liveDcPowerKw, deltaKw, capturePct };
}

/**
 * Diff consecutive telemetry fingerprints to emit human-readable SSE new-data notifications.
 */
function detectWaareeNewData(prevFp, nextFp, istClock, alignment = null) {
  if (!prevFp) return null;
  const reasons = [];
  if (nextFp.yieldToday > prevFp.yieldToday + 0.01) {
    reasons.push(`Today's energy updated (${nextFp.yieldToday.toFixed(1)} kWh)`);
  }
  if (Math.abs(nextFp.livePowerKw - prevFp.livePowerKw) >= 0.03 && nextFp.livePowerKw > 0) {
    reasons.push(`Live inverter power: ${nextFp.livePowerKw.toFixed(2)} kW`);
  }
  if (
    nextFp.todayGenCount > prevFp.todayGenCount ||
    (nextFp.todayLastTime && nextFp.todayLastTime !== prevFp.todayLastTime)
  ) {
    reasons.push(`5-min curve updated (${nextFp.todayGenCount} points)`);
  }
  if (
    nextFp.yesterdayValue > prevFp.yesterdayValue + 0.05 ||
    nextFp.yesterdayGenCount > prevFp.yesterdayGenCount
  ) {
    reasons.push(
      `${istClock.yesterdayShortLabel} inverter EEPROM synced (${nextFp.yesterdayValue.toFixed(1)} kWh)`
    );
  }
  if (Math.abs(nextFp.monthTotal - prevFp.monthTotal) >= 0.1 && reasons.length === 0) {
    reasons.push(`Monthly generation synced (${nextFp.monthTotal.toFixed(1)} kWh)`);
  }
  if (
    didInverterTransitionOnline(
      prevFp.lastUpdateDate,
      nextFp.lastUpdateDate,
      prevFp.statusState,
      nextFp.statusState
    ) &&
    reasons.length === 0
  ) {
    reasons.push(`Inverter online (${nextFp.lastUpdateDate})`);
  }

  if (reasons.length === 0) return null;
  const nowClock = getISTClockSnapshot();
  return {
    eventId: `pkt-${Date.now()}`,
    detectedAtIso: new Date().toISOString(),
    detectedAtIst: nowClock.clockLabel,
    reason: reasons[0],
    details: reasons,
    livePowerKw: nextFp.livePowerKw,
    liveDcPowerKw: nextFp.liveDcPowerKw,
    yieldToday: nextFp.yieldToday,
    yesterdayYmd: istClock.yesterdayYmd,
    yesterdayKwh: nextFp.yesterdayValue,
    todayGenCount: nextFp.todayGenCount,
    todayLastTime: nextFp.todayLastTime,
    monthTotal: nextFp.monthTotal,
    calcKwNow: alignment?.calcKwNow ?? undefined,
    calcCumKwhNow: alignment?.calcCumKwhNow ?? undefined,
    calcFullDayKwh: alignment?.calcFullDayKwh ?? undefined,
    deltaKw: alignment?.deltaKw ?? undefined,
    capturePct: alignment?.capturePct ?? undefined,
  };
}

module.exports = {
  extractFlowAcPowerKw,
  extractFlowDcPowerKw,
  extractFlowPowerKw,
  extractRelativeMinutesAgo,
  isStaleStatusString,
  didInverterTransitionOnline,
  didDongleAgeReset,
  computeWaareeFingerprint,
  computeLiveAlignment,
  detectWaareeNewData,
};
