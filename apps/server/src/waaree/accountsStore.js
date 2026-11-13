const fs = require("fs");
const path = require("path");
const { ACCOUNTS_FILE, TOKEN_FILE } = require("../config/env");
const { loadSettings } = require("../config/settingsStore");

/**
 * Load all registered Waaree accounts from disk.
 * @returns {Array<object>}
 */
function loadAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
    }
  } catch (e) {
    console.error("[Registry] Error reading accounts.json:", e.message);
  }
  return [];
}

/**
 * Persist registered Waaree accounts to disk.
 * @param {Array<object>} accounts
 */
function saveAccounts(accounts) {
  try {
    fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  } catch (e) {
    console.error("[Registry] Error writing accounts.json:", e.message);
  }
}

/**
 * Seed default primary account from token.txt if no accounts are registered yet.
 * Safe to invoke on startup or lazily when the account list is empty.
 * @returns {Array<object>}
 */
function ensureDefaultAccount() {
  const accounts = loadAccounts();
  if (accounts.length === 0 && fs.existsSync(TOKEN_FILE)) {
    const token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    if (token) {
      accounts.push({
        id: "acc-1",
        username: "Solar Account",
        token,
        plants: [],
        addedAt: new Date().toISOString(),
      });
      saveAccounts(accounts);
    }
  }
  return accounts;
}

/**
 * Resolve the API token owning a station ID, falling back to the primary account.
 * @param {string|null|undefined} stationId
 * @returns {string}
 */
function getTokenForStation(stationId) {
  const accounts = loadAccounts();
  if (stationId) {
    for (const acc of accounts) {
      if (acc.plants && acc.plants.some((p) => p.stationID === stationId)) {
        return acc.token;
      }
    }
  }
  return accounts.length > 0 ? accounts[0].token : "";
}

/**
 * Resolve the primary (or overridden) station metadata, token, and commissioning date.
 * @param {string|null} [stationIdOverride]
 * @returns {object}
 */
function getPrimaryStationAndToken(stationIdOverride = null) {
  const accounts = ensureDefaultAccount();
  const settings = loadSettings();
  let stationId = stationIdOverride;
  let token = stationId ? getTokenForStation(stationId) : null;
  let capacity = "3.00";
  let country = "India";
  let plantName = "Solar Station";
  let createdDate = "";

  for (const acc of accounts) {
    if (stationId && acc.plants?.some((p) => p.stationID === stationId)) {
      token = token || acc.token;
      const p = acc.plants.find((x) => x.stationID === stationId);
      if (p) {
        capacity = p.capacity || capacity;
        country = p.country || country;
        plantName = p.plantName || plantName;
        createdDate = p.createdDate || createdDate;
      }
      break;
    }
    if (!stationId && acc.plants?.length > 0) {
      stationId = acc.plants[0].stationID;
      token = acc.token;
      capacity = acc.plants[0].capacity || capacity;
      country = acc.plants[0].country || country;
      plantName = acc.plants[0].plantName || plantName;
      createdDate = acc.plants[0].createdDate || createdDate;
      break;
    }
  }
  if (!token && fs.existsSync(TOKEN_FILE)) {
    token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
  }
  const parsedCreated = String(createdDate || "").slice(0, 10);
  const overrideComm =
    typeof settings.commissioningDateOverride === "string"
      ? settings.commissioningDateOverride.trim()
      : "";
  const commissioningYmd = /^\d{4}-\d{2}-\d{2}$/.test(overrideComm)
    ? overrideComm
    : /^\d{4}-\d{2}-\d{2}$/.test(parsedCreated)
      ? parsedCreated
      : "";

  return {
    stationId,
    token,
    capacity,
    country,
    plantName,
    createdDate,
    commissioningYmd,
  };
}

module.exports = {
  loadAccounts,
  saveAccounts,
  ensureDefaultAccount,
  getTokenForStation,
  getPrimaryStationAndToken,
};
