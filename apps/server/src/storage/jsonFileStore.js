const fs = require("fs");
const path = require("path");
const { CACHE_FILE } = require("../config/env");

/** Safely reads and parses a JSON file on disk, returning `fallback` if missing or invalid. */
function loadJsonFileSafe(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (e) {
    console.error(`[Cache] Error reading ${path.basename(filePath)}:`, e.message);
  }
  return fallback;
}

/** Ensures parent directories exist and serializes formatted JSON cleanly to disk. */
function saveJsonFileSafe(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`[Cache] Error writing ${path.basename(filePath)}:`, e.message);
  }
}

function loadHistoryCache() {
  return loadJsonFileSafe(CACHE_FILE, {});
}

function saveHistoryCache(cache) {
  saveJsonFileSafe(CACHE_FILE, cache);
}

module.exports = {
  loadJsonFileSafe,
  saveJsonFileSafe,
  loadHistoryCache,
  saveHistoryCache,
};
