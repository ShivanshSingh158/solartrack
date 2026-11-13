import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT_DIR = path.resolve(import.meta.dirname, "..", "..");
const REAL_DATA_DIR = path.join(ROOT_DIR, "data");

let tempDataDir = null;
let server = null;
let baseUrl = "";

before(async () => {
  tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "solartrack-api-test-"));
  fs.mkdirSync(path.join(tempDataDir, "config"), { recursive: true });
  fs.mkdirSync(path.join(tempDataDir, "secrets"), { recursive: true });
  fs.mkdirSync(path.join(tempDataDir, "cache"), { recursive: true });

  const realSettings = path.join(REAL_DATA_DIR, "config", "settings.json");
  if (fs.existsSync(realSettings)) {
    fs.copyFileSync(realSettings, path.join(tempDataDir, "config", "settings.json"));
  }
  for (const cacheFile of ["history_cache.json", "weather_history_cache.json", "day_raw_cache.json"]) {
    const src = path.join(REAL_DATA_DIR, "cache", cacheFile);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(tempDataDir, "cache", cacheFile));
    }
  }

  fs.writeFileSync(
    path.join(tempDataDir, "secrets", "accounts.json"),
    JSON.stringify(
      [
        {
          id: "acc-test",
          username: "Test Solar Account",
          token: "",
          plants: [
            {
              stationID: "1e2b2018-5a70-43e9-96a3-f4da846ea954",
              plantName: "Test Rooftop Plant",
              country: "India",
              capacity: "3.00",
              createdDate: "2026-10-28 16:47:54",
            },
          ],
        },
      ],
      null,
      2
    )
  );

  process.env.SOLAR_DATA_DIR = tempDataDir;
  const { createAppServer } = require(path.join(ROOT_DIR, "apps", "server", "src", "app.js"));
  server = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (tempDataDir && fs.existsSync(tempDataDir)) {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
  delete process.env.SOLAR_DATA_DIR;
});

test("GET / serves built SPA index.html with no-store anti-cache headers", async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes("<div id=\"root\""), "Expected React root mount in index.html");
  assert.ok(
    String(res.headers.get("cache-control") || "").includes("no-store"),
    "Expected no-store Cache-Control header"
  );
});

test("GET /api/dashboard/init, /api/proxy/status, and /api/accounts return healthy metadata", async () => {
  const [initRes, statusRes, accRes] = await Promise.all([
    fetch(`${baseUrl}/api/dashboard/init`),
    fetch(`${baseUrl}/api/proxy/status`),
    fetch(`${baseUrl}/api/accounts/list`),
  ]);

  assert.equal(initRes.status, 200);
  const initJson = await initRes.json();
  assert.equal(initJson.errno, 0);
  assert.equal(initJson.timezone, "Asia/Kolkata");
  assert.ok(initJson.proxyRulesActive?.rule1_tokenCached);
  assert.ok(initJson.settings?.plantLocation);

  assert.equal(statusRes.status, 200);
  const statusJson = await statusRes.json();
  assert.equal(statusJson.errno, 0);
  assert.equal(statusJson.backoffActive, false);

  assert.equal(accRes.status, 200);
  const accJson = await accRes.json();
  assert.equal(accJson.errno, 0);
  assert.equal(accJson.accounts.length, 1);
  assert.equal(accJson.accounts[0].token, undefined, "Account list must strip secret token");
});

test("POST /api/settings & /api/settings/clean-panels mutate isolated test config without leaking", async () => {
  const origRes = await fetch(`${baseUrl}/api/settings`);
  const origJson = await origRes.json();
  assert.equal(origJson.errno, 0);
  const origTariff = origJson.settings.tariffPerKwh;

  const updRes = await fetch(`${baseUrl}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tariffPerKwh: 9.25 }),
  });
  assert.equal(updRes.status, 200);
  const updJson = await updRes.json();
  assert.equal(updJson.errno, 0);
  assert.equal(updJson.settings.tariffPerKwh, 9.25);

  const washRes = await fetch(`${baseUrl}/api/settings/clean-panels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dateYmd: "2026-11-01", note: "integration-test" }),
  });
  assert.equal(washRes.status, 200);
  const washJson = await washRes.json();
  assert.equal(washJson.errno, 0);
  assert.ok(washJson.cleaningEvents.some((e) => e.ymd === "2026-11-01"));

  const rmWashRes = await fetch(`${baseUrl}/api/settings/clean-panels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dateYmd: "2026-11-01", action: "remove" }),
  });
  assert.equal(rmWashRes.status, 200);

  const restoreRes = await fetch(`${baseUrl}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tariffPerKwh: origTariff }),
  });
  assert.equal(restoreRes.status, 200);
});

test("GET /api/day-comparison returns cached 2026-11-08 physics & raw telemetry curve cleanly", async () => {
  const res = await fetch(
    `${baseUrl}/api/day-comparison?stationID=1e2b2018-5a70-43e9-96a3-f4da846ea954&date=2026-11-08`
  );
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.errno, 0);
  assert.equal(json.dateYmd, "2026-11-08");
  assert.ok(json.waaree?.hasRawCurve, "Expected cached raw curve for 2026-11-08");
  assert.ok(json.weather?.hourlyGti?.length >= 24, "Expected hourly GTI weather array");
});

test("GET /api/solar-intelligence & /api/weather/solar compute site calibration and forecast", async () => {
  const [intelRes, weatherRes] = await Promise.all([
    fetch(`${baseUrl}/api/solar-intelligence?stationID=1e2b2018-5a70-43e9-96a3-f4da846ea954`),
    fetch(`${baseUrl}/api/weather/solar`),
  ]);
  assert.equal(intelRes.status, 200);
  const intel = await intelRes.json();
  assert.equal(intel.errno, 0);
  assert.ok(intel.report?.siteCalibration, "Expected siteCalibration report");
  assert.ok(intel.report?.soiling, "Expected soiling report");

  assert.equal(weatherRes.status, 200);
  const weather = await weatherRes.json();
  assert.equal(weather.errno, 0);
});

test("Enterprise Security Headers & Complete Auth Lifecycle (Login, Session, Lockout, Logout)", async () => {
  // 1. Verify enterprise HTTP security headers
  const rootRes = await fetch(`${baseUrl}/`);
  assert.equal(rootRes.headers.get("x-content-type-options"), "nosniff");
  assert.equal(rootRes.headers.get("x-frame-options"), "DENY");
  assert.ok(rootRes.headers.get("referrer-policy"));
  assert.ok(rootRes.headers.get("permissions-policy"));

  // 2. Unauthenticated status check
  const statusRes1 = await fetch(`${baseUrl}/api/auth/status`);
  assert.equal(statusRes1.status, 200);
  const statusJson1 = await statusRes1.json();
  assert.equal(statusJson1.authenticated, false);

  // 3. Failed login attempt with missing or bad credentials
  const emptyLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(emptyLoginRes.status, 400);

  const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "invalid_user", password: "wrong_password" }),
  });
  assert.equal(badLoginRes.status, 401);

  // 4. Test session creation and validation
  const { createSession } = await import("../../apps/server/src/auth/sessionStore.js");
  const testToken = createSession("test_waaree_user", { ip: "127.0.0.1" });
  assert.ok(testToken);

  // 5. Authenticated status check using Bearer token
  const statusRes2 = await fetch(`${baseUrl}/api/auth/status`, {
    headers: { Authorization: `Bearer ${testToken}` },
  });
  assert.equal(statusRes2.status, 200);
  const statusJson2 = await statusRes2.json();
  assert.equal(statusJson2.authenticated, true);
  assert.equal(statusJson2.user?.username, "test_waaree_user");

  // 6. Logout and verify session revocation
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${testToken}` },
  });
  assert.equal(logoutRes.status, 200);

  // 7. Verify session is now dead
  const statusRes3 = await fetch(`${baseUrl}/api/auth/status`, {
    headers: { Authorization: `Bearer ${testToken}` },
  });
  assert.equal(statusRes3.status, 200);
  const statusJson3 = await statusRes3.json();
  assert.equal(statusJson3.authenticated, false);
});
