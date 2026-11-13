const solarTruth = require("@solar-track/core/physics");
const {
  DAY_RAW_CACHE_FILE,
  FLOW_CACHE_TTL_MS,
  EARNINGS_CACHE_TTL_MS,
  DEVICE_LIST_CACHE_TTL_MS,
} = require("../config/env");
const { loadSettings, buildPhysicsArgsFromSettings } = require("../config/settingsStore");
const { loadJsonFileSafe, loadHistoryCache } = require("../storage/jsonFileStore");
const {
  completedRawDayCache,
  stationSyncState,
  inFlightSyncs,
  sseSubscribers,
  earningsMemoryCache,
  deviceListMemoryCache,
  getWeatherCache,
  clearWeatherCache,
  isBackoffActive,
  getBackoffRemainingSec,
} = require("../storage/memoryCaches");
const {
  getISTDateParts,
  shiftISTYmd,
  getISTClockSnapshot,
  parseClockMins,
} = require("../time/istClock");
const { getPrimaryStationAndToken } = require("../waaree/accountsStore");
const { sleep } = require("../waaree/httpClient");
const {
  fetchWaareeFlowInternal,
  parseIstUploadTimestamp,
  fetchWaareePlantEarningsInternal,
  fetchWaareeDeviceListInternal,
  fetchWaareeMonthReportInternal,
  fetchMultiYearLifetimeWithMonths,
  fetchWaareeRawDayInternal,
  extractMonthlyDays,
  summarizeRawSeries,
  computeRawCurveTrapezoidalKwh,
  fetchWaareeAlarmsToday,
} = require("../waaree/endpoints");
const {
  fetchDeviceRealAllWebSocket,
  getCachedDeviceRealAll,
} = require("../waaree/deviceRealWebSocket");
const { buildSolarWeatherPayload } = require("../weather/solarWeatherService");
const { computeAndServeSolarIntelligence } = require("../intelligence/intelligenceService");
const {
  extractFlowAcPowerKw,
  extractFlowDcPowerKw,
  didInverterTransitionOnline,
  didDongleAgeReset,
  computeWaareeFingerprint,
  computeLiveAlignment,
  detectWaareeNewData,
} = require("./alignment");
const { broadcastSseEvent } = require("./sseBroker");

/**
 * Execute the full simultaneous Weather + Waaree synchronization pipeline for one station,
 * enforcing monotonic yield reconciliation, earnings/device-list coherence, reconnect
 * backfill, intelligence embedding, and SSE push broadcasts.
 */
async function runSimultaneousSync(
  stationIdInput = null,
  { force = false, trigger = "scheduled", tokenOverride = null } = {}
) {
  const resolved = getPrimaryStationAndToken(stationIdInput);
  const stationId = resolved.stationId;
  const token = tokenOverride || resolved.token;
  if (!stationId || !token) {
    return { errno: -1, error: "No authenticated solar station available" };
  }

  const flightKey = `${stationId}:${force ? "force" : "auto"}`;
  if (inFlightSyncs.has(flightKey)) {
    return inFlightSyncs.get(flightKey);
  }

  const task = (async () => {
    const settings = loadSettings();
    const istClock = getISTClockSnapshot();
    const prevState = stationSyncState.get(stationId) || null;
    const prevFp = prevState?.fingerprint || null;
    const dayRolloverDetected = Boolean(prevFp && prevFp.istYmd !== istClock.ymd);
    const isPreSunriseWindow = istClock.hour >= 4 && istClock.hour < 6;
    const preSunriseNeeded = isPreSunriseWindow && prevState?.lastPreSunriseYmd !== istClock.ymd;
    const forceWaaree = Boolean(force && !isBackoffActive());
    const flowCacheWindowMs = trigger === "scheduled" ? 15000 : FLOW_CACHE_TTL_MS;

    // Step 1: Ping Open-Meteo Weather (12m day / 30m night cache) & Waaree /flow/info SIMULTANEOUSLY
    const [weatherSettled, flowSettled] = await Promise.allSettled([
      buildSolarWeatherPayload(settings, {
        force: force || dayRolloverDetected || preSunriseNeeded,
      }),
      fetchWaareeFlowInternal(
        stationId,
        token,
        forceWaaree || dayRolloverDetected,
        flowCacheWindowMs
      ),
    ]);

    const weatherPayload =
      weatherSettled.status === "fulfilled"
        ? weatherSettled.value
        : { errno: -1, available: false, message: "Weather fetch failed" };
    const flowOutcome =
      flowSettled.status === "fulfilled"
        ? flowSettled.value
        : { data: prevState?.lastSnapshot?.waaree?.flow || null, fromCache: true };
    const flowData = flowOutcome.data || prevState?.lastSnapshot?.waaree?.flow || null;

    const flowStatus = flowData?.result?.status || {};
    const flowYieldToday = parseFloat(flowStatus.yieldToday) || 0;
    const flowLiveKw = extractFlowAcPowerKw(flowData);
    const flowDcKw = extractFlowDcPowerKw(flowData);
    const statusTransitionedOnline = didInverterTransitionOnline(
      prevFp?.lastUpdateDate,
      flowStatus.lastUpdateDate,
      prevFp?.statusState,
      flowStatus.state ?? null
    );
    const dongleHeartbeatReset = didDongleAgeReset(
      prevFp?.lastUpdateDate,
      flowStatus.lastUpdateDate
    );
    const flowChanged = Boolean(
      prevFp &&
        (Math.abs(flowYieldToday - prevFp.yieldToday) >= 0.01 ||
          Math.abs(flowLiveKw - prevFp.livePowerKw) >= 0.03 ||
          statusTransitionedOnline ||
          dongleHeartbeatReset ||
          (flowStatus.state ?? null) !== prevFp.statusState)
    );

    const nowMs = Date.now();
    const rawAgeMs = prevState?.lastRawFetchAt ? nowMs - prevState.lastRawFetchAt : Infinity;
    const monthAgeMs = prevState?.lastMonthFetchAt ? nowMs - prevState.lastMonthFetchAt : Infinity;
    const prevYestZero = prevFp ? prevFp.yesterdayValue <= 0 : true;
    const isGeneratingNow = flowLiveKw > 0.02;
    const isSealTrigger =
      trigger === "dusk_seal" ||
      trigger === "pre_midnight_seal" ||
      trigger === "midnight_rollover" ||
      trigger === "post_midnight_seal";

    const shouldFetchHeavy =
      !isBackoffActive() &&
      (!prevState ||
        forceWaaree ||
        isSealTrigger ||
        dayRolloverDetected ||
        preSunriseNeeded ||
        flowChanged ||
        (isGeneratingNow && rawAgeMs > 150000) ||
        (prevYestZero && monthAgeMs > 300000));

    let monthlyDays = prevState?.lastSnapshot?.waaree?.monthlyDays || [];
    let monthTotal = prevState?.lastSnapshot?.waaree?.summary?.generationMonth || 0;
    let lifetimeTotal = prevState?.lastSnapshot?.waaree?.summary?.generationTotal || 0;
    const prevSummary = prevState?.lastSnapshot?.waaree?.summary || null;
    let hardwareTodayKwh = Number.isFinite(Number(prevSummary?.hardwareTodayKwh))
      ? Number(prevSummary.hardwareTodayKwh)
      : null;
    let hardwareMonthKwh = Number.isFinite(Number(prevSummary?.hardwareMonthKwh))
      ? Number(prevSummary.hardwareMonthKwh)
      : null;
    let hardwareYearKwh = Number.isFinite(Number(prevSummary?.hardwareYearKwh))
      ? Number(prevSummary.hardwareYearKwh)
      : null;
    let hardwareTotalKwh = Number.isFinite(Number(prevSummary?.hardwareTotalKwh))
      ? Number(prevSummary.hardwareTotalKwh)
      : null;
    let hardwareSyncedYmd =
      typeof prevSummary?.hardwareSyncedYmd === "string" ? prevSummary.hardwareSyncedYmd : null;
    let hardwareSyncedMin = Number.isFinite(Number(prevSummary?.hardwareSyncedMin))
      ? Number(prevSummary.hardwareSyncedMin)
      : null;
    let hardwareSyncedLabel =
      typeof prevSummary?.hardwareSyncedLabel === "string"
        ? prevSummary.hardwareSyncedLabel
        : null;
    let earningsSource =
      typeof prevSummary?.earningsSource === "string" ? prevSummary.earningsSource : null;
    let earningsCurrency =
      typeof prevSummary?.earningsCurrency === "string" ? prevSummary.earningsCurrency : null;
    let monthEarnings = Number.isFinite(Number(prevSummary?.monthEarnings))
      ? Number(prevSummary.monthEarnings)
      : null;
    let cumulateEarnings = Number.isFinite(Number(prevSummary?.cumulateEarnings))
      ? Number(prevSummary.cumulateEarnings)
      : null;
    let otherYearsTotal = prevState?.otherYearsTotal || 0;
    let currentYearMonths = Array.isArray(prevState?.lastSnapshot?.waaree?.yearMonths)
      ? prevState.lastSnapshot.waaree.yearMonths
      : loadHistoryCache()[`${stationId}_year_months_${istClock.year}`] || [];
    let generationYesterday = prevState?.lastSnapshot?.waaree?.summary?.generationYesterday || 0;
    let todayRaw = prevState?.lastSnapshot?.waaree?.todayRaw || [];
    let yesterdayRaw = prevState?.lastSnapshot?.waaree?.yesterdayRaw || [];
    let lastSyncedDay = prevState?.lastSnapshot?.waaree?.lastSyncedDay || null;
    let lastRawFetchAt = prevState?.lastRawFetchAt || 0;
    let lastMonthFetchAt = prevState?.lastMonthFetchAt || 0;
    let lastYearFetchAt = prevState?.lastYearFetchAt || 0;
    let lastEarningsFetchAt = prevState?.lastEarningsFetchAt || 0;
    let lastDeviceFetchAt = prevState?.lastDeviceFetchAt || 0;
    let lastReconnectBackfillAt = prevState?.lastReconnectBackfillAt || 0;
    const yestParts = shiftISTYmd(-1);
    const commissioningYmd = resolved.commissioningYmd || "2026-10-28";
    const phys = buildPhysicsArgsFromSettings(settings, parseFloat(resolved.capacity) || 3.0);
    const sysCap = phys.dcCapacityKwp;
    const prevCalMonth = istClock.month === 1 ? 12 : istClock.month - 1;
    const prevCalYear = istClock.month === 1 ? istClock.year - 1 : istClock.year;
    const prevMonthYm = `${prevCalYear}-${String(prevCalMonth).padStart(2, "0")}`;
    let prevMonthDays = Array.isArray(prevState?.lastSnapshot?.waaree?.prevMonthDays)
      ? prevState.lastSnapshot.waaree.prevMonthDays
      : [];

    if (prevMonthDays.length === 0 && prevMonthYm >= commissioningYmd.slice(0, 7)) {
      const diskPrev = loadHistoryCache()[`${stationId}_month_${prevCalYear}_${prevCalMonth}`];
      if (Array.isArray(diskPrev) && diskPrev.length > 0) {
        prevMonthDays = extractMonthlyDays(diskPrev);
      }
    }

    if (shouldFetchHeavy) {
      await sleep(350);
      const monthRes = await fetchWaareeMonthReportInternal(
        stationId,
        istClock.year,
        istClock.month,
        token
      );
      if (monthRes.length > 0) {
        monthlyDays = extractMonthlyDays(monthRes);
        monthTotal = parseFloat(monthlyDays.reduce((s, d) => s + d.value, 0).toFixed(2));
        lastMonthFetchAt = Date.now();
      }

      if (
        (prevMonthDays.length === 0 ||
          yestParts.month !== istClock.month ||
          (istClock.day <= 3 && statusTransitionedOnline)) &&
        prevMonthYm >= commissioningYmd.slice(0, 7) &&
        !isBackoffActive()
      ) {
        await sleep(350);
        const prevMonthRes = await fetchWaareeMonthReportInternal(
          stationId,
          prevCalYear,
          prevCalMonth,
          token,
          Boolean(
            forceWaaree ||
              flowChanged ||
              statusTransitionedOnline ||
              (yestParts.month !== istClock.month && prevYestZero)
          )
        );
        if (prevMonthRes.length > 0) {
          prevMonthDays = extractMonthlyDays(prevMonthRes);
        }
      }

      const yearStale =
        !prevState ||
        forceWaaree ||
        isSealTrigger ||
        dayRolloverDetected ||
        statusTransitionedOnline ||
        nowMs - lastYearFetchAt > 1800000;
      if (yearStale && !isBackoffActive()) {
        await sleep(350);
        const multiYearInfo = await fetchMultiYearLifetimeWithMonths(
          stationId,
          commissioningYmd,
          istClock.year,
          token
        );
        if (multiYearInfo.lifetimeTotal > 0) {
          lifetimeTotal = multiYearInfo.lifetimeTotal;
          otherYearsTotal = multiYearInfo.otherYearsTotal;
          if (
            Array.isArray(multiYearInfo.currentYearMonths) &&
            multiYearInfo.currentYearMonths.length > 0
          ) {
            currentYearMonths = multiYearInfo.currentYearMonths;
          }
          lastYearFetchAt = Date.now();
        }
      }

      if (!isBackoffActive()) {
        await sleep(350);
        todayRaw = await fetchWaareeRawDayInternal(
          stationId,
          { year: istClock.year, month: istClock.month, day: istClock.day },
          istClock.ymd,
          token,
          false
        );

        const yestMonthlyVal =
          yestParts.month === istClock.month
            ? monthlyDays.find((d) => d.index === yestParts.day)?.value || 0
            : prevMonthDays.find((d) => d.index === yestParts.day)?.value || 0;
        generationYesterday = yestMonthlyVal;
        const canCacheYestRaw = yestMonthlyVal > 0 && istClock.yesterdayDay === yestParts.day;
        await sleep(350);
        yesterdayRaw = await fetchWaareeRawDayInternal(
          stationId,
          { year: yestParts.year, month: yestParts.month, day: yestParts.day },
          yestParts.ymd,
          token,
          canCacheYestRaw,
          Boolean(statusTransitionedOnline || isSealTrigger || forceWaaree)
        );
        lastRawFetchAt = Date.now();

        // Dongle Reconnect / Startup Backfill Queue (rate-limited to 1x per 15 min)
        const sunriseMin = parseClockMins(weatherPayload?.todayForecast?.sunrise, 384);
        const todayFirstMin = summarizeRawSeries(todayRaw).firstActiveMin;
        const yestCurveKwh = computeRawCurveTrapezoidalKwh(
          yesterdayRaw,
          sysCap,
          phys.acInverterCapacityKw
        );
        const yestIncomplete =
          summarizeRawSeries(yesterdayRaw).count === 0 ||
          (yestMonthlyVal > 0.25 && yestCurveKwh + 0.35 < yestMonthlyVal);
        const needsReconnectBackfill =
          statusTransitionedOnline ||
          dongleHeartbeatReset ||
          isSealTrigger ||
          (todayFirstMin !== null && todayFirstMin > sunriseMin + 25 && !prevState) ||
          yestIncomplete;
        if (
          needsReconnectBackfill &&
          nowMs - lastReconnectBackfillAt > 900000 &&
          !isBackoffActive()
        ) {
          lastReconnectBackfillAt = Date.now();
          for (let lookback = 2; lookback <= 3; lookback++) {
            const p = shiftISTYmd(-lookback);
            if (p.ymd < commissioningYmd || isBackoffActive()) continue;
            const diskRaw = loadJsonFileSafe(DAY_RAW_CACHE_FILE, {});
            const cachedSeries = diskRaw[`${stationId}_${p.ymd}`];
            const barKwh =
              p.month === istClock.month
                ? monthlyDays.find((d) => d.index === p.day)?.value || 0
                : prevMonthDays.find((d) => d.index === p.day)?.value || 0;
            const cachedKwh = computeRawCurveTrapezoidalKwh(
              cachedSeries,
              sysCap,
              phys.acInverterCapacityKw
            );
            if (
              !Array.isArray(cachedSeries) ||
              cachedSeries.length === 0 ||
              (barKwh > 0.25 && cachedKwh + 0.35 < barKwh)
            ) {
              await sleep(350);
              await fetchWaareeRawDayInternal(
                stationId,
                { year: p.year, month: p.month, day: p.day },
                p.ymd,
                token,
                true,
                true
              );
            }
          }
        }
      }
    } else if (yestParts.month === istClock.month) {
      generationYesterday =
        monthlyDays.find((d) => d.index === yestParts.day)?.value || generationYesterday || 0;
    }

    const roundKwh2 = (v) => (Number.isFinite(Number(v)) ? parseFloat(Number(v).toFixed(2)) : null);
    const earningsStale =
      !prevState ||
      hardwareMonthKwh === null ||
      forceWaaree ||
      isSealTrigger ||
      dayRolloverDetected ||
      statusTransitionedOnline ||
      flowChanged ||
      (isGeneratingNow && nowMs - lastEarningsFetchAt > EARNINGS_CACHE_TTL_MS) ||
      nowMs - lastEarningsFetchAt > 900000;

    if ((shouldFetchHeavy || earningsStale) && !isBackoffActive()) {
      const earningsCacheEntry = earningsMemoryCache.get(stationId);
      const bypassEarningsCache = Boolean(
        forceWaaree || dayRolloverDetected || isSealTrigger || statusTransitionedOnline
      );
      if (
        bypassEarningsCache ||
        !earningsCacheEntry ||
        nowMs - earningsCacheEntry.timestamp >= EARNINGS_CACHE_TTL_MS
      ) {
        await sleep(350);
      }
      const earningsOutcome = await fetchWaareePlantEarningsInternal(
        stationId,
        token,
        bypassEarningsCache,
        EARNINGS_CACHE_TTL_MS
      );
      const er = earningsOutcome.data?.errno === 0 ? earningsOutcome.data.result : null;
      if (er) {
        if (er.today?.generation != null) hardwareTodayKwh = roundKwh2(er.today.generation);
        if (er.month?.generation != null) hardwareMonthKwh = roundKwh2(er.month.generation);
        if (er.year?.generation != null) hardwareYearKwh = roundKwh2(er.year.generation);
        if (er.cumulate?.generation != null) hardwareTotalKwh = roundKwh2(er.cumulate.generation);
        if (typeof er.currency === "string" && er.currency.trim())
          earningsCurrency = er.currency.trim();
        if (er.month?.earnings != null) monthEarnings = roundKwh2(er.month.earnings);
        if (er.cumulate?.earnings != null) cumulateEarnings = roundKwh2(er.cumulate.earnings);
        earningsSource = "waaree-earnings-v0";
        if (!earningsOutcome.fromCache) {
          lastEarningsFetchAt = Date.now();
        }
      }
    }

    const deviceStale =
      !prevState ||
      !hardwareSyncedYmd ||
      hardwareTotalKwh === null ||
      forceWaaree ||
      isSealTrigger ||
      dayRolloverDetected ||
      statusTransitionedOnline ||
      nowMs - lastDeviceFetchAt > DEVICE_LIST_CACHE_TTL_MS;

    if ((shouldFetchHeavy || deviceStale) && !isBackoffActive()) {
      const tokenKey = token ? token.slice(-16) : "none";
      const devCacheEntry = deviceListMemoryCache.get(tokenKey);
      const bypassDevCache = Boolean(
        forceWaaree || dayRolloverDetected || isSealTrigger || statusTransitionedOnline
      );
      if (
        bypassDevCache ||
        !devCacheEntry ||
        nowMs - devCacheEntry.timestamp >= DEVICE_LIST_CACHE_TTL_MS
      ) {
        await sleep(350);
      }
      const devOutcome = await fetchWaareeDeviceListInternal(
        stationId,
        token,
        bypassDevCache,
        DEVICE_LIST_CACHE_TTL_MS
      );
      const dev = devOutcome.device;
      if (dev) {
        if (hardwareTotalKwh === null && dev.generationTotal != null) {
          hardwareTotalKwh = roundKwh2(dev.generationTotal);
        }
        if (hardwareTodayKwh === null && dev.generationToday != null) {
          hardwareTodayKwh = roundKwh2(dev.generationToday);
        }
        const parsedUpload = parseIstUploadTimestamp(dev.dataLatestUploadDate);
        if (parsedUpload) {
          hardwareSyncedYmd = parsedUpload.ymd;
          hardwareSyncedMin = parsedUpload.minutes;
          hardwareSyncedLabel = parsedUpload.label;
        }
        if (!earningsSource && hardwareTotalKwh !== null) {
          earningsSource = "waaree-device-list";
        }
        if (!devOutcome.fromCache) {
          lastDeviceFetchAt = Date.now();
        }
      }
    }

    const syncedDaysBeforeToday = monthlyDays
      .filter((d) => d.index < istClock.day && d.value > 0)
      .sort((a, b) => b.index - a.index);

    if (syncedDaysBeforeToday.length > 0) {
      const latest = syncedDaysBeforeToday[0];
      const pad = (n) => String(n).padStart(2, "0");
      const latestYmd = `${istClock.year}-${pad(istClock.month)}-${pad(latest.index)}`;
      let latestRaw = [];
      if (latest.index === istClock.yesterdayDay && yestParts.month === istClock.month) {
        latestRaw = yesterdayRaw;
      } else if (completedRawDayCache.has(`${stationId}_${latestYmd}`)) {
        latestRaw = completedRawDayCache.get(`${stationId}_${latestYmd}`);
      } else if (
        prevState?.lastSnapshot?.waaree?.lastSyncedDay?.ymd === latestYmd &&
        prevState.lastSnapshot.waaree.lastSyncedDay.raw?.length > 0
      ) {
        latestRaw = prevState.lastSnapshot.waaree.lastSyncedDay.raw;
      } else if (!isBackoffActive()) {
        await sleep(350);
        latestRaw = await fetchWaareeRawDayInternal(
          stationId,
          { year: istClock.year, month: istClock.month, day: latest.index },
          latestYmd,
          token,
          true
        );
      }
      lastSyncedDay = {
        day: latest.index,
        month: istClock.month,
        year: istClock.year,
        ymd: latestYmd,
        shortLabel: `${istClock.monthShort} ${latest.index}`,
        yieldKwh: latest.value,
        raw: latestRaw,
      };
    } else if (prevMonthDays.length > 0) {
      const prevSynced = prevMonthDays
        .filter((d) => d.value > 0)
        .sort((a, b) => b.index - a.index);
      if (prevSynced.length > 0) {
        const latest = prevSynced[0];
        const pad = (n) => String(n).padStart(2, "0");
        const latestYmd = `${yestParts.year}-${pad(yestParts.month)}-${pad(latest.index)}`;
        const monthShortPrev =
          ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
            yestParts.month - 1
          ] || "";
        lastSyncedDay = {
          day: latest.index,
          month: yestParts.month,
          year: yestParts.year,
          ymd: latestYmd,
          shortLabel: `${monthShortPrev} ${latest.index}`,
          yieldKwh: latest.value,
          raw: latest.index === yestParts.day ? yesterdayRaw : [],
        };
      }
    }

    // Monotonic Today Yield + Inline Month/Year Coherence (eliminates 122.4 vs 122.7 drift & post-sunset zero wipe)
    const rawCurveTrapKwh = computeRawCurveTrapezoidalKwh(
      todayRaw,
      sysCap,
      phys.acInverterCapacityKw
    );
    const monthTodayBarVal = monthlyDays.find((d) => d.index === istClock.day)?.value || 0;
    const prevTodayResolved =
      prevState?.lastSnapshot?.istClock?.ymd === istClock.ymd
        ? Number(prevState?.lastSnapshot?.waaree?.summary?.generationToday || 0)
        : 0;
    const resolvedTodayKwh = parseFloat(
      Math.max(flowYieldToday, monthTodayBarVal, rawCurveTrapKwh, prevTodayResolved).toFixed(2)
    );
    if (resolvedTodayKwh > 0 || monthlyDays.some((d) => d.index === istClock.day)) {
      let patchedToday = false;
      monthlyDays = monthlyDays.map((d) => {
        if (d.index === istClock.day) {
          patchedToday = true;
          return { ...d, value: parseFloat(Math.max(d.value || 0, resolvedTodayKwh).toFixed(2)) };
        }
        return d;
      });
      if (!patchedToday && resolvedTodayKwh > 0) {
        monthlyDays = [...monthlyDays, { index: istClock.day, value: resolvedTodayKwh }].sort(
          (a, b) => a.index - b.index
        );
      }
      monthTotal = parseFloat(
        monthlyDays.reduce((s, d) => s + (Number(d.value) || 0), 0).toFixed(2)
      );
    }
    if (Array.isArray(currentYearMonths) && currentYearMonths.length > 0) {
      let patchedMonth = false;
      currentYearMonths = currentYearMonths.map((m) => {
        if (Number(m.index) === istClock.month) {
          patchedMonth = true;
          return { ...m, value: parseFloat(Math.max(Number(m.value) || 0, monthTotal).toFixed(2)) };
        }
        return m;
      });
      if (!patchedMonth && monthTotal > 0) {
        currentYearMonths = [
          ...currentYearMonths,
          { index: istClock.month, value: monthTotal },
        ].sort((a, b) => a.index - b.index);
      }
      const yearSumPatched = currentYearMonths.reduce((s, m) => s + (Number(m.value) || 0), 0);
      lifetimeTotal = parseFloat(
        Math.max(monthTotal, (Number(otherYearsTotal) || 0) + yearSumPatched).toFixed(2)
      );
    } else if (monthTotal > lifetimeTotal) {
      lifetimeTotal = monthTotal;
    }

    const nextFp = computeWaareeFingerprint({
      flowData,
      monthlyDays,
      todayRaw,
      yesterdayRaw,
      istClock,
      monthTotal,
      lifetimeTotal,
      yesterdayMonthlyVal: generationYesterday,
    });
    const alignment = computeLiveAlignment(weatherPayload, flowLiveKw, sysCap, istClock, flowDcKw);
    const newPacketEvent = detectWaareeNewData(prevFp, nextFp, istClock, alignment);
    const activePollIntervalSec =
      istClock.minutesSinceMidnight >= 270 && istClock.minutesSinceMidnight <= 1140 ? 65 : 180;

    let activeDev = null;
    const devTokenKey = token ? token.slice(-16) : "none";
    const devCached = deviceListMemoryCache.get(devTokenKey);
    if (devCached && Array.isArray(devCached.devices)) {
      activeDev = devCached.devices.find((d) => d && d.stationID === stationId) || devCached.devices[0] || null;
    }
    if (!activeDev && !isBackoffActive()) {
      try {
        const devOutcome = await fetchWaareeDeviceListInternal(stationId, token, false, DEVICE_LIST_CACHE_TTL_MS);
        activeDev = devOutcome.device;
      } catch (_) {}
    }

    let realElectrical = getCachedDeviceRealAll();
    let alarmsData = null;

    if (activeDev?.deviceID && !isBackoffActive()) {
      try {
        const wsAgeMs = trigger === "scheduled" ? 25000 : 30000;
        const freshReal = await fetchDeviceRealAllWebSocket(activeDev.deviceID, token, wsAgeMs);
        if (freshReal) {
          realElectrical = freshReal;
        }
      } catch (wsErr) {
        console.warn("[Live Sync] WebSocket real/all fetch fallback:", wsErr.message);
      }
    }

    try {
      alarmsData = await fetchWaareeAlarmsToday(stationId, token, activeDev?.deviceSN);
    } catch (alarmErr) {
      console.warn("[Live Sync] Alarms fetch fallback:", alarmErr.message);
    }

    const todayRawSummary = summarizeRawSeries(todayRaw);
    const hasTodayActiveCurve = todayRawSummary.count > 0 || resolvedTodayKwh > 0.05;
    const todayTruthCheck = solarTruth.evaluateTelemetryTruth(
      flowStatus.lastUpdateDate || (flowLiveKw > 0.02 ? "Just now" : "2 days ago"),
      flowLiveKw,
      resolvedTodayKwh,
      flowStatus.state ?? 1,
      realElectrical?.grid?.r?.volt || 0,
      realElectrical?.grid?.r?.freqHz || 0,
      "auto",
      {
        sunriseMin: parseClockMins(weatherPayload?.todayForecast?.sunrise, 384),
        sunsetMin: parseClockMins(weatherPayload?.todayForecast?.sunset, 1040),
        todayEstKwh: weatherPayload?.todayForecast?.expectedYieldKwh ?? 10.5,
        todayRadMj: weatherPayload?.todayForecast?.radiationMjM2 ?? 15.3,
        nowMinutesIst: istClock.minutesSinceMidnight,
        capacityKwp: sysCap,
        hasTodayActiveCurve,
        todayCurveKwh: rawCurveTrapKwh,
      }
    );
    const isHardwareLive = Boolean(
      todayTruthCheck.isFromToday &&
        (todayTruthCheck.status === "LIVE" ||
          todayTruthCheck.status === "WARMUP" ||
          todayTruthCheck.status === "DELAYED" ||
          (todayTruthCheck.status === "NIGHT_SLEEP" &&
            (resolvedTodayKwh > 0 || todayRawSummary.count > 0)))
    );

    if (!hardwareSyncedYmd && (hardwareMonthKwh !== null || hardwareTotalKwh !== null)) {
      const flowTs = parseIstUploadTimestamp(flowStatus.lastUpdateDate);
      if (flowTs) {
        hardwareSyncedYmd = flowTs.ymd;
        hardwareSyncedMin = flowTs.minutes;
        hardwareSyncedLabel = flowTs.label;
      } else if (todayTruthCheck.isFromToday && isHardwareLive) {
        hardwareSyncedYmd = istClock.ymd;
        hardwareSyncedMin = todayTruthCheck.latestPacketMinute ?? istClock.minutesSinceMidnight;
        hardwareSyncedLabel = `${istClock.ymd} ${istClock.clockLabel}`;
      }
    }

    const waareeBlock = {
      fetchedAtIso: new Date().toISOString(),
      fromCache: flowOutcome.fromCache && !shouldFetchHeavy,
      isHardwareLive,
      inBackoff: isBackoffActive(),
      backoffRemainingSec: getBackoffRemainingSec(),
      flow: flowData,
      realElectrical: realElectrical || null,
      alarms: alarmsData || null,
      summary: {
        generationToday: resolvedTodayKwh,
        flowYieldTodayRaw: parseFloat(flowYieldToday.toFixed(2)),
        generationYesterday: parseFloat((generationYesterday || 0).toFixed(2)),
        generationMonth: monthTotal,
        generationTotal: lifetimeTotal,
        hardwareTodayKwh,
        hardwareMonthKwh,
        hardwareYearKwh,
        hardwareTotalKwh,
        hardwareSyncedYmd,
        hardwareSyncedMin,
        hardwareSyncedLabel,
        earningsSource,
        earningsCurrency,
        monthEarnings,
        cumulateEarnings,
        lastUpdateDate: flowStatus.lastUpdateDate || "Updated",
        capacity: resolved.capacity,
        country: resolved.country,
      },
      monthlyDays,
      yearMonths: currentYearMonths,
      prevMonthYm,
      prevMonthDays,
      todayRaw,
      yesterdayRaw,
      lastSyncedDay,
    };

    let embeddedIntelReport = prevState?.lastSnapshot?.intelligenceReport || null;
    try {
      const weatherCache = getWeatherCache();
      const intelPayload = await computeAndServeSolarIntelligence(stationId, {
        force: Boolean(force || dayRolloverDetected),
        weatherOverride: weatherCache.data,
        snapOverride: { waaree: waareeBlock },
        settingsOverride: settings,
        resolvedOverride: resolved,
        istClockOverride: istClock,
      });
      if (intelPayload?.report) {
        embeddedIntelReport = intelPayload.report;
      }
    } catch (intelErr) {
      console.warn("[Live Sync] SolarIntelligence embed fallback:", intelErr.message);
    }

    const snapshot = {
      errno: 0,
      stationId,
      trigger,
      syncedAtIso: new Date().toISOString(),
      syncedAtIstLabel: istClock.clockLabel,
      istClock,
      weather: weatherPayload,
      alignment,
      waaree: waareeBlock,
      realElectrical: realElectrical || null,
      alarms: alarmsData || null,
      intelligenceReport: embeddedIntelReport,
      events: {
        dayRolloverDetected,
        preSunriseSynced: isPreSunriseWindow,
        newDataDetected: Boolean(newPacketEvent),
        latestNewData: newPacketEvent || prevState?.lastNewDataEvent || null,
      },
      syncHealth: {
        nextPollInSec: activePollIntervalSec,
        mode:
          istClock.minutesSinceMidnight >= 270 && istClock.minutesSinceMidnight <= 1140
            ? "daytime"
            : "night",
        sseClients: sseSubscribers.get(stationId)?.size || 0,
      },
    };

    stationSyncState.set(stationId, {
      lastSnapshot: snapshot,
      fingerprint: nextFp,
      lastRawFetchAt,
      lastMonthFetchAt,
      lastYearFetchAt,
      lastEarningsFetchAt,
      lastDeviceFetchAt,
      lastReconnectBackfillAt,
      otherYearsTotal,
      lastPreSunriseYmd: isPreSunriseWindow ? istClock.ymd : prevState?.lastPreSunriseYmd || null,
      lastNewDataEvent: newPacketEvent || prevState?.lastNewDataEvent || null,
    });

    broadcastSseEvent(stationId, "sync_snapshot", snapshot);
    if (dayRolloverDetected || preSunriseNeeded) {
      broadcastSseEvent(stationId, "day_rollover", {
        istClock,
        trigger,
        preSunriseNeeded,
      });
    }
    if (newPacketEvent) {
      console.log(
        `[Live Sync] New Waaree telemetry detected for ${stationId}: ${newPacketEvent.reason}`
      );
      broadcastSseEvent(stationId, "waaree_new_data", newPacketEvent);
    }

    return snapshot;
  })();

  inFlightSyncs.set(flightKey, task);
  try {
    return await task;
  } finally {
    inFlightSyncs.delete(flightKey);
  }
}

/**
 * Start startup cache warm-up, 15s IST daily seal/rollover checkpoint watcher, and
 * adaptive 65s daytime / 180s nighttime SSE broadcast scheduler.
 */
function startSyncSchedulers() {
  let watcherLastYmd = getISTDateParts().ymd;
  let watcherPreSunriseYmd = getISTDateParts().hour >= 5 ? watcherLastYmd : null;
  let watcherDuskSealYmd = null;
  let watcherPreMidnightSealYmd = null;
  let watcherPostMidnightSealYmd = null;

  const startupTimer = setTimeout(() => {
    const primary = getPrimaryStationAndToken();
    if (primary.stationId && primary.token) {
      runSimultaneousSync(primary.stationId, { force: false, trigger: "startup" }).catch(() => {});
    }
  }, 1500);

  const rolloverInterval = setInterval(() => {
    const ist = getISTDateParts();
    const targets = Array.from(
      new Set([...Array.from(sseSubscribers.keys()), getPrimaryStationAndToken().stationId].filter(Boolean))
    );

    if (ist.ymd !== watcherLastYmd) {
      watcherLastYmd = ist.ymd;
      console.log(
        `[IST Rollover] Midnight rollover detected (${ist.ymd}). Refreshing weather & station state...`
      );
      clearWeatherCache();
      targets.forEach((sid) => {
        runSimultaneousSync(sid, { force: true, trigger: "midnight_rollover" }).catch(() => {});
      });
    }

    if (ist.hour === 0 && ist.minute >= 5 && ist.minute < 25 && watcherPostMidnightSealYmd !== ist.ymd) {
      watcherPostMidnightSealYmd = ist.ymd;
      console.log(
        `[IST Seal] 00:05 post-midnight archive seal (${ist.ymd}). Finalizing previous day EEPROM & raw curve...`
      );
      targets.forEach((sid) => {
        runSimultaneousSync(sid, { force: true, trigger: "post_midnight_seal" }).catch(() => {});
      });
    }

    if (ist.hour >= 5 && watcherPreSunriseYmd !== ist.ymd) {
      watcherPreSunriseYmd = ist.ymd;
      console.log(
        `[IST Rollover] Pre-sunrise window (${ist.clockLabel}). Pre-syncing Open-Meteo + Waaree before sunrise...`
      );
      clearWeatherCache();
      targets.forEach((sid) => {
        runSimultaneousSync(sid, { force: true, trigger: "pre_sunrise_rollover" }).catch(() => {});
      });
    }

    const weatherCache = getWeatherCache();
    const sunsetMin = parseClockMins(weatherCache?.data?.todayForecast?.sunset, 1040);
    if (
      ist.minutesSinceMidnight >= sunsetMin + 20 &&
      ist.minutesSinceMidnight < sunsetMin + 55 &&
      watcherDuskSealYmd !== ist.ymd
    ) {
      watcherDuskSealYmd = ist.ymd;
      console.log(
        `[IST Seal] Sunset+20m dusk seal (${ist.clockLabel}). Capturing today's final EEPROM & raw curve before inverter sleeps...`
      );
      targets.forEach((sid) => {
        runSimultaneousSync(sid, { force: true, trigger: "dusk_seal" }).catch(() => {});
      });
    }

    if (ist.hour === 23 && ist.minute >= 52 && watcherPreMidnightSealYmd !== ist.ymd) {
      watcherPreMidnightSealYmd = ist.ymd;
      console.log(
        `[IST Seal] 23:52 pre-midnight seal (${ist.ymd}). Locking full-day curve before Waaree midnight EEPROM reset...`
      );
      targets.forEach((sid) => {
        runSimultaneousSync(sid, { force: true, trigger: "pre_midnight_seal" }).catch(() => {});
      });
    }
  }, 15000);

  let adaptiveTimer = null;
  let stopped = false;
  const scheduleAdaptiveSync = () => {
    if (stopped) return;
    const ist = getISTDateParts();
    const isDayWindow = ist.minutesSinceMidnight >= 270 && ist.minutesSinceMidnight <= 1140;
    const delayMs = isDayWindow ? 65000 : 180000;
    adaptiveTimer = setTimeout(async () => {
      try {
        if (sseSubscribers.size > 0) {
          for (const sid of Array.from(sseSubscribers.keys())) {
            await runSimultaneousSync(sid, { force: false, trigger: "scheduled" });
          }
        }
      } catch (err) {
        console.error("[Live Sync] Scheduled tick error:", err.message);
      } finally {
        scheduleAdaptiveSync();
      }
    }, delayMs);
  };
  scheduleAdaptiveSync();

  return () => {
    stopped = true;
    clearTimeout(startupTimer);
    clearInterval(rolloverInterval);
    if (adaptiveTimer) clearTimeout(adaptiveTimer);
  };
}

module.exports = {
  runSimultaneousSync,
  startSyncSchedulers,
};
