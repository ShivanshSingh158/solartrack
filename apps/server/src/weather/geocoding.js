const https = require("https");

/**
 * Reverse-geocode lat/lon coordinates into human-readable city/state/country metadata.
 */
function reverseGeocode(lat, lon) {
  return new Promise((resolve) => {
    const url = `https://api-bdc.io/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    https
      .get(
        url,
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SolarTrack/2.0" } },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              const city =
                parsed.city ||
                parsed.locality ||
                parsed.principalSubdivision ||
                "Unknown Location";
              const state = parsed.principalSubdivision || "";
              const formatted = state && state !== city ? `${city}, ${state}` : city;
              resolve({
                name: formatted,
                city,
                state,
                lat: parseFloat(lat),
                lon: parseFloat(lon),
                country: parsed.countryName || "India",
              });
            } catch {
              resolve({
                name: `Rooftop (${parseFloat(lat).toFixed(4)}°N, ${parseFloat(lon).toFixed(4)}°E)`,
                city: "Rooftop Site",
                state: "",
                lat: parseFloat(lat),
                lon: parseFloat(lon),
                country: "India",
              });
            }
          });
        }
      )
      .on("error", (err) => {
        console.error("[Geocode API] Error:", err.message);
        resolve({
          name: `Rooftop (${parseFloat(lat).toFixed(4)}°N, ${parseFloat(lon).toFixed(4)}°E)`,
          city: "Rooftop Site",
          state: "",
          lat: parseFloat(lat),
          lon: parseFloat(lon),
          country: "India",
        });
      });
  });
}

/**
 * Resolve a free-form city name or coordinate pair into geographic site metadata.
 */
function searchLocation(query) {
  return new Promise((resolve) => {
    if (!query) return resolve(null);
    const cleaned = query.trim();
    const coordMatch = cleaned.match(
      /^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/
    );
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return reverseGeocode(lat, lon).then(resolve);
      }
    }

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      cleaned
    )}&count=5&language=en&format=json`;
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.results && parsed.results.length > 0) {
              const best = parsed.results[0];
              const state = best.admin1 || "";
              const formatted = state ? `${best.name}, ${state}` : best.name;
              resolve({
                name: formatted,
                city: best.name,
                state: best.admin1 || "",
                lat: best.latitude,
                lon: best.longitude,
                country: best.country || "India",
              });
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

module.exports = {
  reverseGeocode,
  searchLocation,
};
