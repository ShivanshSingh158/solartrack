const { handleSseStream } = require("../sync/sseBroker");
const { runSimultaneousSync } = require("../sync/syncCoordinator");
const { sendJson } = require("./httpUtils");

/**
 * Handle `/api/live/sync` and `/api/live/stream`.
 * @returns {Promise<boolean>}
 */
async function handleSyncRoutes(req, res, reqUrl) {
  if (reqUrl.pathname === "/api/live/sync" && req.method === "GET") {
    const stationId = reqUrl.searchParams.get("stationID") || null;
    const force = reqUrl.searchParams.get("force") === "true";
    const token = req.headers.token || null;
    try {
      const snapshot = await runSimultaneousSync(stationId, {
        force,
        trigger: force ? "manual" : "poll",
        tokenOverride: token,
      });
      sendJson(res, 200, snapshot);
    } catch (err) {
      sendJson(res, 500, { errno: -1, error: err.message });
    }
    return true;
  }

  if (reqUrl.pathname === "/api/live/stream" && req.method === "GET") {
    handleSseStream(req, res, reqUrl, runSimultaneousSync);
    return true;
  }

  return false;
}

module.exports = {
  handleSyncRoutes,
};
