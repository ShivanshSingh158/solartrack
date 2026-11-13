const crypto = require("crypto");
const { WS_HOST } = require("../config/env");

let cachedRealData = null;
let lastFetchTime = 0;
let isFetching = false;
let pendingResolvers = [];

/**
 * Extract numerical variable value from values array.
 * @param {Array<{variable: string, value: any}>} values
 * @param {string} varName
 * @returns {number|null}
 */
function getVarNum(values, varName) {
  if (!Array.isArray(values)) return null;
  const item = values.find(
    (v) => v && String(v.variable).toLowerCase() === varName.toLowerCase()
  );
  if (!item || item.value === undefined || item.value === null) return null;
  const num = Number(item.value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Extract string variable value.
 * @param {Array<{variable: string, value: any}>} values
 * @param {string} varName
 * @returns {string|null}
 */
function getVarStr(values, varName) {
  if (!Array.isArray(values)) return null;
  const item = values.find(
    (v) => v && String(v.variable).toLowerCase() === varName.toLowerCase()
  );
  return item && item.value !== undefined ? String(item.value) : null;
}

/**
 * Parse raw WebSocket response into a structured electrical telemetry object.
 * @param {object} payload
 * @returns {object|null}
 */
function parseRealAllPayload(payload) {
  if (!payload || !payload.data || !Array.isArray(payload.data.blocks)) return null;
  const realBlock = payload.data.blocks.find(
    (b) => b && (b.blockName === "RealData" || Array.isArray(b.values))
  );
  const values = realBlock ? realBlock.values : [];

  const pv1Volt = getVarNum(values, "PV1Volt");
  const pv1Current = getVarNum(values, "PV1Current");
  const pv1Power = getVarNum(values, "PV1Power");

  const pv2Volt = getVarNum(values, "PV2Volt") ?? 0;
  const pv2Current = getVarNum(values, "PV2Current") ?? 0;
  const pv2Power = getVarNum(values, "PV2Power") ?? 0;

  const rVolt = getVarNum(values, "RVolt");
  const rCurrent = getVarNum(values, "RCurrent");
  const rFreq = getVarNum(values, "RFreq");
  const rPower = getVarNum(values, "RPower");

  const sVolt = getVarNum(values, "SVolt") ?? 0;
  const tVolt = getVarNum(values, "TVolt") ?? 0;

  const invTemp = getVarNum(values, "invTemp") ?? getVarNum(values, "InvTemp");
  const ambientTemp = getVarNum(values, "ambientTemp") ?? getVarNum(values, "AmbientTemp");
  const boostTemp = getVarNum(values, "boostTemp") ?? getVarNum(values, "BoostTemp");
  const isoResistance = getVarNum(values, "iso") ?? getVarNum(values, "isoResistance") ?? getVarNum(values, "Iso");

  const timeStr = getVarStr(values, "Time");
  const timeStamp = values.find((v) => v && v.timestamp > 0)?.timestamp || Date.now();

  return {
    deviceID: payload.data.deviceID,
    status: payload.data.status,
    timestamp: timeStamp,
    timeText: timeStr || new Date().toISOString(),
    dc: {
      pv1: { volt: pv1Volt, current: pv1Current, powerKw: pv1Power },
      pv2: { volt: pv2Volt, current: pv2Current, powerKw: pv2Power, isUnwired: pv2Volt === 0 && pv2Power === 0 },
      pv3: { volt: getVarNum(values, "PV3Volt") ?? 0, powerKw: getVarNum(values, "PV3Power") ?? 0, isUnwired: true },
      pv4: { volt: getVarNum(values, "PV4Volt") ?? 0, powerKw: getVarNum(values, "PV4Power") ?? 0, isUnwired: true },
      totalDcKw: (pv1Power || 0) + (pv2Power || 0),
    },
    grid: {
      r: { volt: rVolt, current: rCurrent, freqHz: rFreq, powerKw: rPower },
      s: { volt: sVolt, powerKw: getVarNum(values, "SPower") ?? 0 },
      t: { volt: tVolt, powerKw: getVarNum(values, "TPower") ?? 0 },
      totalAcKw: rPower || 0,
      phaseCount: sVolt > 10 || tVolt > 10 ? 3 : 1,
    },
    efficiency: {
      etaPct:
        pv1Power && rPower && pv1Power > 0.05
          ? +((rPower / pv1Power) * 100).toFixed(2)
          : null,
      conversionLossWatts:
        pv1Power && rPower && pv1Power >= rPower
          ? +((pv1Power - rPower) * 1000).toFixed(0)
          : null,
    },
    temperatures: {
      invTemp,
      ambientTemp,
      boostTemp,
    },
    safety: {
      isoResistance,
    },
    rawValues: values,
  };
}

/**
 * Fetch fresh real-time multi-string electrical telemetry over WebSocket.
 * @param {string} deviceID
 * @param {string} token
 * @param {number} [maxAgeMs=30000]
 * @returns {Promise<object|null>}
 */
async function fetchDeviceRealAllWebSocket(deviceID, token, maxAgeMs = 30000) {
  if (cachedRealData && Date.now() - lastFetchTime < maxAgeMs) {
    return cachedRealData;
  }

  if (isFetching) {
    return new Promise((resolve) => {
      pendingResolvers.push(resolve);
    });
  }

  isFetching = true;

  return new Promise((resolve) => {
    const finish = (result) => {
      if (result) {
        cachedRealData = result;
        lastFetchTime = Date.now();
      }
      isFetching = false;
      const resolvers = pendingResolvers;
      pendingResolvers = [];
      resolve(result || cachedRealData);
      resolvers.forEach((r) => r(result || cachedRealData));
    };

    try {
      const timestamp = Date.now().toString();
      const path = "/c/v0/device/real/all";
      const rawSig = `${path}\r\n${token}\r\n${timestamp}`;
      const signature = crypto.createHash("md5").update(rawSig).digest("hex");

      const wsUrl = WS_HOST || "wss://digital.waaree.com/c/v0/websocket";
      const headers = {
        user: "token",
        signature,
        timestamp,
        version: "v1.0.3",
        lang: "en",
        timezone: "Asia/Kolkata",
        token,
      };

      let ws;
      try {
        ws = new WebSocket(wsUrl, { headers });
      } catch (_) {
        return finish(cachedRealData);
      }

      let timer = null;

      if (typeof ws.addEventListener === "function") {
        ws.addEventListener("error", () => {
          if (timer) clearTimeout(timer);
          finish(cachedRealData);
        });
      }

      ws.onopen = () => {
        const req = {
          parameters: {
            deviceID,
            chargersSN: [],
            wifiMeterID: "",
          },
          resource: path,
          msgType: "request",
          sequence: Date.now().toString(),
          interval: 10,
          token,
          lang: "en",
        };
        ws.send(JSON.stringify(req) + "\r\n");

        timer = setTimeout(() => {
          try {
            ws.close();
          } catch (_) {}
          finish(cachedRealData);
        }, 6000);
      };

      ws.onmessage = (event) => {
        try {
          const raw = typeof event.data === "string" ? event.data.trim() : "";
          if (!raw) return;
          const json = JSON.parse(raw);
          if (json.msgType === "data" && json.data) {
            if (timer) clearTimeout(timer);
            const parsed = parseRealAllPayload(json);
            try {
              ws.close();
            } catch (_) {}
            finish(parsed);
          }
        } catch (_) {}
      };

      ws.onerror = () => {
        if (timer) clearTimeout(timer);
        finish(cachedRealData);
      };

      ws.onclose = () => {
        if (timer) clearTimeout(timer);
        finish(cachedRealData);
      };
    } catch (_) {
      finish(cachedRealData);
    }
  });
}

function getCachedDeviceRealAll() {
  return cachedRealData;
}

module.exports = {
  fetchDeviceRealAllWebSocket,
  getCachedDeviceRealAll,
  parseRealAllPayload,
};
