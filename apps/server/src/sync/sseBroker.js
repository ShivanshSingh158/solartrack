const { sseSubscribers, stationSyncState } = require("../storage/memoryCaches");
const { getPrimaryStationAndToken } = require("../waaree/accountsStore");

/**
 * Push an SSE named event to every active subscriber registered for a station.
 */
function broadcastSseEvent(stationId, eventName, payload) {
  const subs = sseSubscribers.get(stationId);
  if (!subs || subs.size === 0) return;
  const serialized = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const clientRes of Array.from(subs)) {
    try {
      clientRes.write(serialized);
    } catch {
      subs.delete(clientRes);
    }
  }
}

/**
 * Broadcast `settings_updated` across all active station SSE streams.
 */
function broadcastSettingsUpdated(settings, extra = {}) {
  for (const sid of sseSubscribers.keys()) {
    broadcastSseEvent(sid, "settings_updated", { settings, ...extra });
  }
}

/**
 * Handle `GET /api/live/stream` Server-Sent Events connection lifecycle,
 * immediately emitting the latest cached snapshot (or triggering an async sync).
 */
function handleSseStream(req, res, reqUrl, onConnectSync) {
  const requestedStationId = reqUrl.searchParams.get("stationID");
  const { stationId } = getPrimaryStationAndToken(requestedStationId);
  if (!stationId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ errno: -1, error: "stationID not found" }));
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: 5000\n\n`);

  if (!sseSubscribers.has(stationId)) {
    sseSubscribers.set(stationId, new Set());
  }
  sseSubscribers.get(stationId).add(res);

  const existing = stationSyncState.get(stationId)?.lastSnapshot;
  if (existing) {
    res.write(`event: sync_snapshot\ndata: ${JSON.stringify(existing)}\n\n`);
  } else if (typeof onConnectSync === "function") {
    onConnectSync(stationId, { force: false, trigger: "sse_connect" }).catch(() => {});
  }

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const set = sseSubscribers.get(stationId);
    if (set) {
      set.delete(res);
      if (set.size === 0) sseSubscribers.delete(stationId);
    }
  });
}

module.exports = {
  broadcastSseEvent,
  broadcastSettingsUpdated,
  handleSseStream,
};
