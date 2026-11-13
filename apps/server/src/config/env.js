const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..", "..", "..", "..");
const DATA_DIR = process.env.SOLAR_DATA_DIR
  ? path.resolve(process.env.SOLAR_DATA_DIR)
  : path.join(ROOT_DIR, "data");

const CONFIG_DIR = path.join(DATA_DIR, "config");
const SECRETS_DIR = path.join(DATA_DIR, "secrets");
const CACHE_DIR = path.join(DATA_DIR, "cache");
const PUBLIC_DIR = path.join(ROOT_DIR, "apps", "server", "public");

module.exports = {
  PORT: process.env.PORT || 3000,
  API_HOST: "digital.waaree.com",
  WS_HOST: "wss://digital.waaree.com/c/v0/websocket",
  ROOT_DIR,
  DATA_DIR,
  CONFIG_DIR,
  SECRETS_DIR,
  CACHE_DIR,
  PUBLIC_DIR,

  ACCOUNTS_FILE: path.join(SECRETS_DIR, "accounts.json"),
  TOKEN_FILE: path.join(SECRETS_DIR, "token.txt"),
  SETTINGS_FILE: path.join(CONFIG_DIR, "settings.json"),
  CACHE_FILE: path.join(CACHE_DIR, "history_cache.json"),
  WEATHER_HISTORY_CACHE_FILE: path.join(CACHE_DIR, "weather_history_cache.json"),
  DAY_RAW_CACHE_FILE: path.join(CACHE_DIR, "day_raw_cache.json"),

  DAY_WEATHER_CACHE_TTL_MS: 12 * 60 * 1000,
  NIGHT_WEATHER_CACHE_TTL_MS: 30 * 60 * 1000,
  FLOW_CACHE_TTL_MS: 30 * 1000,
  EARNINGS_CACHE_TTL_MS: 180 * 1000,
  DEVICE_LIST_CACHE_TTL_MS: 300 * 1000,
  MIN_REQUEST_INTERVAL_MS: 400,
  ANNUAL_BASELINE_TTL_MS: 30 * 86400 * 1000,
};
