const fs = require("fs");
const {
  checkLoginRateLimit,
  recordLoginAttempt,
  createSession,
  validateSession,
  revokeSession,
  extractSessionToken,
} = require("../auth/sessionStore");
const { getPrimaryStationAndToken } = require("../waaree/accountsStore");
const path = require("path");
const { TOKEN_FILE } = require("../config/env");
const { loadAccounts, saveAccounts } = require("../waaree/accountsStore");
const { md5, queuedForwardToWaaree, sleep } = require("../waaree/httpClient");
const { sendJson, readJsonBody } = require("./httpUtils");

/**
 * Authenticate a Waaree cloud user, fetch their plant droplist, and upsert into accounts.json.
 * Deduplicates both by username and by stationID to prevent duplicate plant entries.
 */
async function authenticateAndUpsertAccount({
  username,
  password,
  saveTokenFile = false,
  insertAtStart = false,
}) {
  const passwordHash = md5(password);
  const postData = `user=${encodeURIComponent(username)}&password=${encodeURIComponent(
    passwordHash
  )}`;

  const result = await queuedForwardToWaaree("POST", "/c/v0/user/login", postData, "");
  let accObj = null;
  if (result.data && result.data.errno === 0 && result.data.result && result.data.result.token) {
    const token = result.data.result.token;
    if (saveTokenFile) {
      try {
        fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
        fs.writeFileSync(TOKEN_FILE, token);
      } catch {}
    }

    await sleep(350);
    const dropRes = await queuedForwardToWaaree("GET", "/generic/v0/plant/droplist", null, token);
    let plants = [];
    if (dropRes.data && dropRes.data.result) {
      plants = Array.isArray(dropRes.data.result)
        ? dropRes.data.result
        : dropRes.data.result.plants || [];
    }

    const accounts = loadAccounts();
    const newStationIds = new Set(plants.map((p) => p.stationID || p.id).filter(Boolean));

    // Match existing account by username OR matching stationID to avoid duplicates
    const existingIdx = accounts.findIndex(
      (a) =>
        a.username.toLowerCase() === username.toLowerCase() ||
        (Array.isArray(a.plants) && a.plants.some((p) => newStationIds.has(p.stationID)))
    );

    accObj = {
      id: existingIdx >= 0 ? accounts[existingIdx].id : `acc-${Date.now()}`,
      username,
      token,
      plants: plants.map((p) => ({
        stationID: p.stationID || p.id,
        plantName: p.plantName || "Solar Station",
        country: p.country || "India",
        capacity: "3.00",
        createdDate: p.createdDate || "",
      })),
      lastSync: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      accounts[existingIdx] = accObj;
    } else if (insertAtStart) {
      accounts.unshift(accObj);
    } else {
      accounts.push(accObj);
    }
    saveAccounts(accounts);
  }
  return { result, accObj };
}

/**
 * Handle `/api/auth/*` and `/api/accounts*` routes.
 * @returns {Promise<boolean>}
 */
async function handleAuthRoutes(req, res, reqUrl) {
  if (reqUrl.pathname === "/api/auth/status" && req.method === "GET") {
    const sessionToken = extractSessionToken(req);
    const session = validateSession(sessionToken);
    const accounts = loadAccounts();
    const primary = getPrimaryStationAndToken();

    if (session) {
      sendJson(res, 200, {
        errno: 0,
        authenticated: true,
        user: {
          username: session.username,
          plantName: primary?.plantName || "Rooftop Solar Plant",
          stationID: primary?.stationId || "",
          accountsCount: accounts.length,
        },
      });
      return true;
    }

    sendJson(res, 200, {
      errno: 0,
      authenticated: false,
      hasConfiguredAccount: accounts.length > 0,
    });
    return true;
  }

  if (reqUrl.pathname === "/api/auth/login" && req.method === "POST") {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const rateCheck = checkLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      sendJson(res, 429, {
        errno: 429,
        error: `Account temporarily locked out due to multiple failed attempts. Try again in ${rateCheck.remainingSec}s.`,
      });
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const { username, password } = body || {};

      if (!username || !password) {
        sendJson(res, 400, { errno: -1, error: "Waaree username and password required" });
        return true;
      }

      const { result, accObj } = await authenticateAndUpsertAccount({
        username,
        password,
        saveTokenFile: true,
        insertAtStart: true,
      });

      if (accObj && result.data && result.data.errno === 0) {
        recordLoginAttempt(ip, true);
        const sessionToken = createSession(username, {
          ip,
          userAgent: req.headers["user-agent"],
        });
        res.setHeader(
          "Set-Cookie",
          `solartrack_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
        );
        sendJson(res, 200, {
          errno: 0,
          authenticated: true,
          sessionToken,
          user: {
            username: accObj.username,
            plantName: accObj.plants?.[0]?.plantName || "Rooftop Solar Plant",
            stationID: accObj.plants?.[0]?.stationID || "",
          },
        });
      } else {
        recordLoginAttempt(ip, false);
        sendJson(res, 401, {
          errno: result.data ? result.data.errno : -1,
          error: "Invalid username or password. Check your digital.waaree.com credentials.",
        });
      }
    } catch (err) {
      recordLoginAttempt(ip, false);
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/auth/logout" && req.method === "POST") {
    const sessionToken = extractSessionToken(req);
    if (sessionToken) {
      revokeSession(sessionToken);
    }
    res.setHeader(
      "Set-Cookie",
      `solartrack_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
    );
    sendJson(res, 200, {
      errno: 0,
      authenticated: false,
      message: "Logged out successfully",
    });
    return true;
  }

  if (reqUrl.pathname === "/api/login" && req.method === "POST") {
    try {
      const { username, password } = await readJsonBody(req);
      if (!username || !password) {
        sendJson(res, 400, { errno: -1, error: "Username and password required" });
        return true;
      }
      const { result } = await authenticateAndUpsertAccount({
        username,
        password,
        saveTokenFile: true,
      });
      sendJson(res, 200, result.data || { errno: -1, error: "No response from cloud" });
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (
    (reqUrl.pathname === "/api/accounts/list" || reqUrl.pathname === "/api/accounts") &&
    req.method === "GET"
  ) {
    const safeAccounts = loadAccounts().map((a) => ({
      id: a.id,
      username: a.username,
      plants: a.plants,
      lastSync: a.lastSync,
    }));
    sendJson(res, 200, { errno: 0, accounts: safeAccounts });
    return true;
  }

  if (
    reqUrl.pathname === "/api/accounts/test-connection" &&
    (req.method === "GET" || req.method === "POST")
  ) {
    const t0 = Date.now();
    const accounts = loadAccounts();
    if (accounts.length === 0) {
      sendJson(res, 200, {
        errno: -1,
        success: false,
        latencyMs: 0,
        message: "No Waaree accounts configured.",
      });
      return true;
    }
    const acc = accounts[0];
    const pingRes = await queuedForwardToWaaree(
      "GET",
      "/generic/v0/plant/droplist",
      null,
      acc.token || ""
    );
    const latencyMs = Date.now() - t0;
    const ok = pingRes.status === 200 && pingRes.data && pingRes.data.errno === 0;
    sendJson(res, 200, {
      errno: ok ? 0 : pingRes.data?.errno || -1,
      success: ok,
      status: pingRes.status,
      latencyMs,
      message: ok
        ? `Connected to Waaree Cloud (${latencyMs}ms latency · Session Token Active)`
        : `Upstream error: HTTP ${pingRes.status} (${pingRes.data?.msg || "Check credentials"})`,
      upstreamHost: "digital.waaree.com",
    });
    return true;
  }

  if (reqUrl.pathname === "/api/accounts/add" && req.method === "POST") {
    try {
      const { username, password } = await readJsonBody(req);
      if (!username || !password) {
        sendJson(res, 400, { errno: -1, error: "Username and password required" });
        return true;
      }
      const { result, accObj } = await authenticateAndUpsertAccount({
        username,
        password,
        saveTokenFile: false,
        insertAtStart: false,
      });
      if (accObj) {
        sendJson(res, 200, {
          errno: 0,
          message: "Account connected successfully",
          account: accObj,
        });
      } else {
        sendJson(res, 401, {
          errno: result.data ? result.data.errno : -1,
          error: "Authentication failed. Check credentials.",
        });
      }
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname.startsWith("/api/accounts/") && req.method === "DELETE") {
    const accId = reqUrl.pathname.replace("/api/accounts/", "");
    const accounts = loadAccounts().filter((a) => a.id !== accId);
    saveAccounts(accounts);
    sendJson(res, 200, { errno: 0, message: "Account removed" });
    return true;
  }

  return false;
}

module.exports = {
  handleAuthRoutes,
  authenticateAndUpsertAccount,
};
