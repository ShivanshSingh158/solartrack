const { EARNINGS_CACHE_TTL_MS, DEVICE_LIST_CACHE_TTL_MS } = require("../config/env");
const { loadHistoryCache, saveHistoryCache } = require("../storage/jsonFileStore");
const {
  getCachedFlow,
  setCachedFlow,
  isBackoffActive,
  getBackoffRemainingSec,
} = require("../storage/memoryCaches");
const { getISTDate } = require("../time/istClock");
const {
  loadAccounts,
  getTokenForStation,
  getPrimaryStationAndToken,
} = require("../waaree/accountsStore");
const { queuedForwardToWaaree, sleep } = require("../waaree/httpClient");
const {
  parseIstUploadTimestamp,
  fetchWaareePlantEarningsInternal,
  fetchWaareeDeviceListInternal,
  fetchMultiYearLifetimeKwh,
  fetchWaareeAlarmsToday,
} = require("../waaree/endpoints");
const {
  fetchDeviceRealAllWebSocket,
  getCachedDeviceRealAll,
} = require("../waaree/deviceRealWebSocket");
const { sendJson, readJsonBody } = require("./httpUtils");

const round2 = (v) => (Number.isFinite(Number(v)) ? parseFloat(Number(v).toFixed(2)) : null);

/**
 * Resolve live `/flow/info` data using the 30s memory cache first, or fetch & stagger.
 */
async function resolveFlowDataForStation(stationId, token) {
  const cachedFlow = getCachedFlow(stationId);
  if (cachedFlow) {
    return cachedFlow.data;
  }
  const flowRes = await queuedForwardToWaaree(
    "GET",
    `/generic/v0/plant/flow/info?stationID=${encodeURIComponent(stationId)}`,
    null,
    token
  );
  let flowResData = null;
  if (flowRes.data && flowRes.data.errno === 0) {
    setCachedFlow(stationId, flowRes.data);
    flowResData = flowRes.data;
  }
  await sleep(350);
  return flowResData;
}

/**
 * Fetch earnings detail + device-list hardware register snapshot sequentially.
 */
async function resolveHardwareRegisterFields(stationId, token) {
  await sleep(350);
  const earningsOut = await fetchWaareePlantEarningsInternal(
    stationId,
    token,
    false,
    EARNINGS_CACHE_TTL_MS
  );
  const er = earningsOut.data?.errno === 0 ? earningsOut.data.result : null;
  if (!earningsOut.fromCache) await sleep(350);
  const devOut = await fetchWaareeDeviceListInternal(
    stationId,
    token,
    false,
    DEVICE_LIST_CACHE_TTL_MS
  );
  const parsedUp = parseIstUploadTimestamp(devOut.device?.dataLatestUploadDate);
  const hwTotal =
    er?.cumulate?.generation != null
      ? round2(er.cumulate.generation)
      : devOut.device?.generationTotal != null
        ? round2(devOut.device.generationTotal)
        : null;
  const hwToday =
    er?.today?.generation != null
      ? round2(er.today.generation)
      : devOut.device?.generationToday != null
        ? round2(devOut.device.generationToday)
        : null;
  const hwMonth = er?.month?.generation != null ? round2(er.month.generation) : null;
  const hwYear = er?.year?.generation != null ? round2(er.year.generation) : null;

  return {
    hardwareTodayKwh: hwToday,
    hardwareMonthKwh: hwMonth,
    hardwareYearKwh: hwYear,
    hardwareTotalKwh: hwTotal,
    hardwareSyncedYmd: parsedUp?.ymd || null,
    hardwareSyncedMin: parsedUp?.minutes ?? null,
    hardwareSyncedLabel: parsedUp?.label || null,
    earningsSource: er ? "waaree-earnings-v0" : hwTotal != null ? "waaree-device-list" : null,
    earningsCurrency: typeof er?.currency === "string" ? er.currency.trim() : null,
    monthEarnings: er?.month?.earnings != null ? round2(er.month.earnings) : null,
    cumulateEarnings: er?.cumulate?.earnings != null ? round2(er.cumulate.earnings) : null,
  };
}

/**
 * Handle `/api/combined/*`, `/api/plant/*`, and `/api/flow` routes.
 * @returns {Promise<boolean>}
 */
async function handlePlantRoutes(req, res, reqUrl) {
  if (reqUrl.pathname === "/api/combined/summary" && req.method === "GET") {
    try {
      const accounts = loadAccounts();
      if (accounts.length === 0) {
        sendJson(res, 200, {
          errno: 0,
          result: { totalYieldToday: 0, totalYieldMonth: 0, totalYieldLifetime: 0, plants: [] },
        });
        return true;
      }

      const istNow = getISTDate();
      const currentYear = istNow.getFullYear();
      const currentMonth = istNow.getMonth() + 1;
      const plantResults = [];

      for (const acc of accounts) {
        for (const p of acc.plants) {
          const sid = p.stationID;
          const flowResData = await resolveFlowDataForStation(sid, acc.token);

          const monthRes = await queuedForwardToWaaree(
            "POST",
            "/generic/v0/plant/history/report",
            {
              stationID: sid,
              reportType: "month",
              queryDate: { year: currentYear, month: currentMonth },
              variables: ["generation", "feedin", "gridConsumption"],
            },
            acc.token
          );
          await sleep(350);

          const commissioningYmd = p.createdDate || "2026-10-28";
          const lifetimeYield = await fetchMultiYearLifetimeKwh(
            sid,
            commissioningYmd,
            currentYear,
            acc.token
          );
          await sleep(250);

          let liveSolarPower = 0;
          let liveInverterPower = 0;
          let liveGridPower = 0;
          let yieldToday = 0;
          let statusText = "Active";

          if (flowResData && flowResData.result) {
            const node = flowResData.result.node;
            if (node) {
              if (node.solar && node.solar.power)
                liveSolarPower = parseFloat(node.solar.power.value) || 0;
              if (node.device && node.device.power)
                liveInverterPower = parseFloat(node.device.power.value) || 0;
              if (node.grid && node.grid.power)
                liveGridPower = parseFloat(node.grid.power.value) || 0;
            }
            if (flowResData.result.status) {
              yieldToday = parseFloat(flowResData.result.status.yieldToday) || 0;
              statusText = flowResData.result.status.lastUpdateDate || "Active";
            }
          }

          let monthYield = 0;
          if (monthRes.data && monthRes.data.result) {
            const genObj = monthRes.data.result.find((v) => v.variable === "generation");
            if (genObj && genObj.data) {
              monthYield = genObj.data.reduce((s, d) => s + (parseFloat(d.value) || 0), 0);
            }
          }

          const hw = await resolveHardwareRegisterFields(sid, acc.token);

          plantResults.push({
            stationID: sid,
            plantName: p.plantName,
            accountUser: acc.username,
            capacity: parseFloat(p.capacity) || 3.0,
            liveSolarPower,
            liveInverterPower,
            liveGridPower,
            yieldToday,
            monthYield,
            lifetimeYield,
            hardwareTodayKwh: hw.hardwareTodayKwh,
            hardwareMonthKwh: hw.hardwareMonthKwh,
            hardwareTotalKwh: hw.hardwareTotalKwh,
            hardwareSyncedYmd: hw.hardwareSyncedYmd,
            hardwareSyncedMin: hw.hardwareSyncedMin,
            hardwareSyncedLabel: hw.hardwareSyncedLabel,
            earningsSource: hw.earningsSource,
            statusText,
          });
        }
      }

      const combinedHwMonth =
        plantResults.every((p) => p.hardwareMonthKwh != null) && plantResults.length > 0
          ? parseFloat(
              plantResults.reduce((s, p) => s + (p.hardwareMonthKwh || 0), 0).toFixed(2)
            )
          : null;
      const combinedHwTotal =
        plantResults.every((p) => p.hardwareTotalKwh != null) && plantResults.length > 0
          ? parseFloat(
              plantResults.reduce((s, p) => s + (p.hardwareTotalKwh || 0), 0).toFixed(2)
            )
          : null;

      sendJson(res, 200, {
        errno: 0,
        result: {
          totalPlants: plantResults.length,
          totalCapacity: plantResults.reduce((s, p) => s + p.capacity, 0),
          liveSolarPower: plantResults.reduce((s, p) => s + p.liveSolarPower, 0),
          liveInverterPower: plantResults.reduce((s, p) => s + p.liveInverterPower, 0),
          liveGridPower: plantResults.reduce((s, p) => s + p.liveGridPower, 0),
          yieldToday: parseFloat(plantResults.reduce((s, p) => s + p.yieldToday, 0).toFixed(2)),
          yieldMonth: parseFloat(plantResults.reduce((s, p) => s + p.monthYield, 0).toFixed(2)),
          yieldLifetime: parseFloat(
            plantResults.reduce((s, p) => s + p.lifetimeYield, 0).toFixed(2)
          ),
          hardwareMonthKwh: combinedHwMonth,
          hardwareTotalKwh: combinedHwTotal,
          plants: plantResults,
          backoffActive: isBackoffActive(),
          backoffRemainingSec: getBackoffRemainingSec(),
        },
      });
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/combined/raw" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const accounts = loadAccounts();
      const rawResults = [];

      for (const acc of accounts) {
        for (const p of acc.plants) {
          const resData = await queuedForwardToWaaree(
            "POST",
            "/generic/v0/plant/history/raw",
            {
              stationID: p.stationID,
              timespan: payload.timespan || "day",
              beginDate: payload.beginDate,
              variables: ["generationPower", "pvPower", "feedinPower"],
            },
            acc.token
          );
          rawResults.push({
            plantName: p.plantName,
            stationID: p.stationID,
            result: resData.data ? resData.data.result : [],
          });
          await sleep(350);
        }
      }

      const timeMap = new Map();
      rawResults.forEach((pr) => {
        if (!pr.result) return;
        const genObj = pr.result.find((v) => v.variable === "generationPower");
        if (genObj && genObj.data) {
          genObj.data.forEach((pt) => {
            const timePart = (pt.time.split(" ")[1] || pt.time).slice(0, 5);
            const val = parseFloat(pt.value) || 0;
            if (!timeMap.has(timePart)) {
              timeMap.set(timePart, { time: timePart, combined: 0, plants: {} });
            }
            const entry = timeMap.get(timePart);
            entry.combined = parseFloat((entry.combined + val).toFixed(3));
            entry.plants[pr.plantName] = val;
          });
        }
      });

      const sortedMerged = Array.from(timeMap.values()).sort((a, b) =>
        a.time.localeCompare(b.time)
      );
      sendJson(res, 200, { errno: 0, result: { merged: sortedMerged, rawPlants: rawResults } });
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/plant/droplist" && req.method === "GET") {
    const token = req.headers.token || getTokenForStation();
    try {
      const result = await queuedForwardToWaaree("GET", "/generic/v0/plant/droplist", null, token);
      sendJson(res, result.status || 200, result.data);
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/device/real-all" && req.method === "GET") {
    const stationId = reqUrl.searchParams.get("stationID") || getPrimaryStationAndToken().stationId;
    const token = req.headers.token || getTokenForStation(stationId) || getPrimaryStationAndToken().token;

    try {
      const devOut = await fetchWaareeDeviceListInternal(stationId, token, false, DEVICE_LIST_CACHE_TTL_MS);
      const deviceID = devOut.device?.deviceID || reqUrl.searchParams.get("deviceID");
      if (!deviceID) {
        return sendJson(res, 200, { errno: 0, result: getCachedDeviceRealAll() || null, note: "No deviceID found" });
      }
      const data = await fetchDeviceRealAllWebSocket(deviceID, token);
      sendJson(res, 200, { errno: 0, result: data });
    } catch (err) {
      sendJson(res, 200, { errno: 0, result: getCachedDeviceRealAll() || null, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/plant/alarms" && req.method === "GET") {
    const stationId = reqUrl.searchParams.get("stationID") || getPrimaryStationAndToken().stationId;
    const token = req.headers.token || getTokenForStation(stationId) || getPrimaryStationAndToken().token;

    try {
      const devOut = await fetchWaareeDeviceListInternal(stationId, token, false, DEVICE_LIST_CACHE_TTL_MS);
      const deviceSN = devOut.device?.deviceSN || reqUrl.searchParams.get("deviceSN") || "";
      const alarms = await fetchWaareeAlarmsToday(stationId, token, deviceSN);
      sendJson(res, 200, { errno: 0, result: alarms });
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/flow" && req.method === "GET") {
    const stationId = reqUrl.searchParams.get("stationID");
    const token = req.headers.token || getTokenForStation(stationId);

    const cachedFlow = getCachedFlow(stationId);
    if (cachedFlow) {
      sendJson(res, 200, {
        ...cachedFlow.data,
        cached: true,
        cacheAgeSec: cachedFlow.ageSec,
        cacheRemainingSec: cachedFlow.remainingSec,
      });
      return true;
    }

    try {
      const result = await queuedForwardToWaaree(
        "GET",
        `/generic/v0/plant/flow/info?stationID=${encodeURIComponent(stationId)}`,
        null,
        token
      );
      if (result.data && result.data.errno === 0) {
        setCachedFlow(stationId, result.data);
      }
      sendJson(res, result.status || 200, result.data);
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/plant/detail" && req.method === "GET") {
    const stationId = reqUrl.searchParams.get("stationID");
    const token = req.headers.token || getTokenForStation(stationId);
    try {
      const istNow = getISTDate();
      const currentYear = istNow.getFullYear();
      const currentMonth = istNow.getMonth() + 1;

      const flowResData = await resolveFlowDataForStation(stationId, token);

      const monthRes = await queuedForwardToWaaree(
        "POST",
        "/generic/v0/plant/history/report",
        {
          stationID: stationId,
          reportType: "month",
          queryDate: { year: currentYear, month: currentMonth },
          variables: ["generation", "feedin", "gridConsumption", "loads"],
        },
        token
      );
      await sleep(350);

      const resolvedDetail = getPrimaryStationAndToken(stationId);
      const lifetimeTotal = await fetchMultiYearLifetimeKwh(
        stationId,
        resolvedDetail.commissioningYmd || "2026-10-28",
        currentYear,
        token
      );

      let yieldToday = 0;
      let lastUpdate = "Active";
      if (flowResData && flowResData.result && flowResData.result.status) {
        yieldToday = parseFloat(flowResData.result.status.yieldToday) || 0;
        lastUpdate = flowResData.result.status.lastUpdateDate || "Active";
      }

      let monthTotal = 0;
      if (monthRes.data && monthRes.data.result) {
        const genItem = monthRes.data.result.find((v) => v.variable === "generation");
        if (genItem && genItem.data) {
          monthTotal = genItem.data.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
        }
      }

      const hw = await resolveHardwareRegisterFields(stationId, token);

      sendJson(res, 200, {
        errno: 0,
        result: {
          generationToday: parseFloat(yieldToday.toFixed(2)),
          generationMonth: parseFloat(monthTotal.toFixed(2)),
          generationTotal: parseFloat(lifetimeTotal.toFixed(2)),
          ...hw,
          lastUpdateDate: lastUpdate,
          capacity: "3.00",
          country: "India",
          backoffActive: isBackoffActive(),
          backoffRemainingSec: getBackoffRemainingSec(),
        },
      });
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/plant/raw" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const token = req.headers.token || getTokenForStation(payload.stationID);
      if (!payload.variables || payload.variables.length === 0) {
        payload.variables = [
          "generationPower",
          "pvPower",
          "feedinPower",
          "gridConsumptionPower",
          "loadsPower",
          "radiation",
        ];
      }
      const result = await queuedForwardToWaaree(
        "POST",
        "/generic/v0/plant/history/raw",
        payload,
        token
      );
      sendJson(res, result.status || 200, result.data);
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/plant/history" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const token = req.headers.token || getTokenForStation(payload.stationID);
      if (!payload.variables || payload.variables.length === 0) {
        payload.variables = [
          "generation",
          "feedin",
          "gridConsumption",
          "loads",
          "radiation",
          "irradiation",
        ];
      }

      const cacheKey = `${payload.stationID}_${payload.reportType}_${
        payload.queryDate?.year || ""
      }_${payload.queryDate?.month || ""}`;
      const cache = loadHistoryCache();
      const istNow = getISTDate();
      const currentYear = istNow.getFullYear();
      const currentMonth = istNow.getMonth() + 1;
      const currentDay = istNow.getDate();

      const isCurrentMonth =
        payload.reportType === "month" &&
        payload.queryDate?.year === currentYear &&
        payload.queryDate?.month === currentMonth;

      const isPastMonth =
        payload.reportType === "month" &&
        (payload.queryDate?.year < currentYear ||
          (payload.queryDate?.year === currentYear && payload.queryDate?.month < currentMonth));

      if (isPastMonth && cache[cacheKey]) {
        sendJson(res, 200, { errno: 0, result: cache[cacheKey], cached: true });
        return true;
      }

      const result = await queuedForwardToWaaree(
        "POST",
        "/generic/v0/plant/history/report",
        payload,
        token
      );

      if (result.data && result.data.errno === 0 && result.data.result) {
        if (isPastMonth) {
          cache[cacheKey] = result.data.result;
          saveHistoryCache(cache);
        } else if (isCurrentMonth) {
          const safeSeries = result.data.result.map((series) => ({
            ...series,
            data: series.data ? series.data.filter((d) => d.index < currentDay) : [],
          }));
          cache[cacheKey] = safeSeries;
          saveHistoryCache(cache);
        }
      } else if (isCurrentMonth && cache[cacheKey]) {
        sendJson(res, 200, { errno: 0, result: cache[cacheKey], cached: true, fallback: true });
        return true;
      }

      sendJson(res, result.status || 200, result.data);
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  return false;
}

module.exports = {
  handlePlantRoutes,
};
