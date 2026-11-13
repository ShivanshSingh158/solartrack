const { PORT, API_HOST } = require("./config/env");
const { ensureDefaultAccount } = require("./waaree/accountsStore");
const { initWasmSigner } = require("./waaree/signer/waareeSigner");
const { startSyncSchedulers } = require("./sync/syncCoordinator");
const { createAppServer } = require("./app");

process.on("uncaughtException", (err) => {
  console.error("[Process Guard] Uncaught exception safely handled:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error(
    "[Process Guard] Unhandled rejection safely handled:",
    reason?.message || reason
  );
});

ensureDefaultAccount();
initWasmSigner().catch((err) =>
  console.warn("[Waaree Signer] WASM init fallback:", err.message)
);

const server = createAppServer();

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  SOLARTRACK BACKEND PROXY (Anti-Flagging Hardened)`);
  console.log(`  Rule 1: In-Memory Token Cache (Zero unnecessary logins)`);
  console.log(`  Rule 2: 30-Second Server-Side /flow/info Memory Cache`);
  console.log(`  Rule 3: Official Android 14 com.odm.waaree Headers`);
  console.log(`  Rule 4: Sequential Queue with 400ms Stagger (No Bursts)`);
  console.log(`  Rule 5: 10-Minute Auto-Backoff on 429/Errors`);
  console.log(`  Live Sync: Simultaneous Weather + Waaree SSE Pipeline`);
  console.log(`  Running at: http://localhost:${PORT}`);
  console.log(`  Connected to https://${API_HOST}`);
  console.log(`======================================================\n`);

  startSyncSchedulers();
});
