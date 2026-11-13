const https = require("https");
const crypto = require("crypto");
const { API_HOST, MIN_REQUEST_INTERVAL_MS } = require("../config/env");
const {
  triggerAutoBackoff,
  isBackoffActive,
  getBackoffRemainingSec,
  getBackoffReason,
  saveLastKnown,
  getLastKnown,
} = require("../storage/memoryCaches");
const {
  generateWaareeSignatureAsync,
  generateWaareeSignatureSync,
} = require("./signer/waareeSigner");

/**
 * Compute lowercase hex MD5 digest (used for Waaree login password hashing).
 * @param {string} str
 * @returns {string}
 */
function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

/**
 * Synchronously compute Waaree request signature using loaded WASM signer or MD5 fallback.
 * @param {string} apiPath
 * @param {string} token
 * @param {string} timestamp
 * @param {string} [lang="en"]
 * @returns {string}
 */
function generateSignature(apiPath, token, timestamp, lang = "en") {
  return generateWaareeSignatureSync(apiPath, token, timestamp, lang);
}

/**
 * Async delay helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detect whether a Waaree HTTP response or errno indicates an expired/invalid token.
 * @param {number} status
 * @param {object} data
 * @returns {boolean}
 */
function isTokenExpiredResponse(status, data) {
  if (status === 401) return true;
  if (data && typeof data === "object") {
    const errno = data.errno;
    if (errno === 41808 || errno === 41809) return true;
    const msg = (data.msg || data.error || "").toLowerCase();
    if (
      msg.includes("token") &&
      (msg.includes("expire") || msg.includes("invalid") || msg.includes("timeout"))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Send a signed HTTPS request to the Waaree cloud API.
 * @param {string} method
 * @param {string} apiPath
 * @param {string|object|null} postData
 * @param {string} [token=""]
 * @param {string} [lang="en"]
 * @returns {Promise<{status: number, data?: object, raw?: string}>}
 */
async function forwardToWaaree(method, apiPath, postData, token = "", lang = "en") {
  const timestamp = Date.now().toString();
  const signature = await generateWaareeSignatureAsync(apiPath, token, timestamp, lang);

  return new Promise((resolve, reject) => {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Connection: "keep-alive",
      Origin: "https://digital.waaree.com",
      Referer: "https://digital.waaree.com/",
      lang,
      timezone: "Asia/Kolkata",
      timestamp,
      signature,
    };

    if (token) {
      headers.token = token;
    }

    let bodyStr = null;
    if (postData) {
      if (typeof postData === "string") {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        headers["Content-Length"] = Buffer.byteLength(postData);
        bodyStr = postData;
      } else {
        headers["Content-Type"] = "application/json;charset=UTF-8";
        bodyStr = JSON.stringify(postData);
        headers["Content-Length"] = Buffer.byteLength(bodyStr);
      }
    }

    const options = {
      hostname: API_HOST,
      port: 443,
      path: apiPath,
      method,
      headers,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", (err) => {
      console.error(`[Waaree Proxy] Error on ${apiPath}:`, err.message);
      reject(err);
    });

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

let lastOutboundTime = 0;
let requestDispatchQueue = Promise.resolve();

/**
 * Serialize outbound Waaree requests with >=400ms stagger, automatic backoff on
 * rate limit/5xx errors, and last-known response fallback on cooldown/network loss.
 * @param {string} method
 * @param {string} apiPath
 * @param {string|object|null} postData
 * @param {string} [token=""]
 * @param {string} [lang="en"]
 * @returns {Promise<{status: number, data?: object, raw?: string}>}
 */
function queuedForwardToWaaree(method, apiPath, postData, token = "", lang = "en") {
  const cacheKey = `${method}:${apiPath}:${
    typeof postData === "object" ? JSON.stringify(postData) : postData || ""
  }`;

  requestDispatchQueue = requestDispatchQueue.then(async () => {
    if (isBackoffActive()) {
      const remainingSec = getBackoffRemainingSec();
      const reason = getBackoffReason();
      const fallback = getLastKnown(cacheKey);
      if (fallback) {
        console.log(
          `[Auto-Backoff] Serving last-known cached data for ${apiPath} (${remainingSec}s remaining in cooldown)`
        );
        return {
          status: 200,
          data: {
            ...fallback.data,
            cached: true,
            fallback: true,
            inBackoff: true,
            backoffRemainingSec: remainingSec,
            backoffReason: reason,
          },
        };
      }
      return {
        status: 429,
        data: {
          errno: 429,
          error: `Auto-backoff active: ${reason}. Cooldown remaining: ${remainingSec}s`,
          inBackoff: true,
          backoffRemainingSec: remainingSec,
          backoffReason: reason,
        },
      };
    }

    const now = Date.now();
    const elapsed = now - lastOutboundTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
    }
    lastOutboundTime = Date.now();

    try {
      const result = await forwardToWaaree(method, apiPath, postData, token, lang);

      if (result.data && (result.data.errno === 0 || result.status === 200)) {
        saveLastKnown(cacheKey, result.data);
      }

      if (isTokenExpiredResponse(result.status, result.data)) {
        console.warn(`[Token Expired] Waaree returned 401/41808/41809 for ${apiPath}.`);
      }

      if (
        result.status === 429 ||
        (result.data && (result.data.errno === 429 || result.data.errno === 4029))
      ) {
        triggerAutoBackoff(
          10,
          `Upstream Rate Limit Exceeded (HTTP ${result.status} / errno ${result.data?.errno})`
        );
      } else if (result.status >= 500) {
        triggerAutoBackoff(5, `Upstream Cloud Server Error (HTTP ${result.status})`);
      }

      return result;
    } catch (err) {
      const fallback = getLastKnown(cacheKey);
      if (fallback) {
        return {
          status: 200,
          data: {
            ...fallback.data,
            cached: true,
            fallback: true,
            networkError: err.message,
          },
        };
      }
      return {
        status: 503,
        data: {
          errno: -3008,
          error: `Network unreachable: ${err.message}`,
          networkError: err.message,
        },
      };
    }
  });

  return requestDispatchQueue;
}

module.exports = {
  md5,
  generateSignature,
  sleep,
  isTokenExpiredResponse,
  forwardToWaaree,
  queuedForwardToWaaree,
};
