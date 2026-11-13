const http = require("http");
const fs = require("fs");
const path = require("path");
const { PUBLIC_DIR } = require("./config/env");
const { handleAuthRoutes } = require("./routes/authRoutes");
const { handlePlantRoutes } = require("./routes/plantRoutes");
const { handleSettingsRoutes } = require("./routes/settingsRoutes");
const { handleWeatherRoutes } = require("./routes/weatherRoutes");
const { handleSyncRoutes } = require("./routes/syncRoutes");
const { handleMobileApiRoutes } = require("./routes/mobileApiRoutes");

const CONTENT_TYPES = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/**
 * Resolve and stream static built SPA assets with stale-hash fallback and no-store headers.
 */
function serveStaticAsset(pathname, res) {
  const safeSubPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const publicRoot = path.resolve(PUBLIC_DIR);
  let filePath = path.resolve(publicRoot, safeSubPath);
  if (!filePath.startsWith(publicRoot)) {
    filePath = path.join(publicRoot, "index.html");
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (pathname.startsWith("/assets/") && pathname.endsWith(".js")) {
      const assetsDir = path.join(publicRoot, "assets");
      const jsFiles = fs.existsSync(assetsDir)
        ? fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"))
        : [];
      if (jsFiles.length > 0) {
        filePath = path.join(assetsDir, jsFiles[0]);
      }
    } else if (pathname.startsWith("/assets/") && pathname.endsWith(".css")) {
      const assetsDir = path.join(publicRoot, "assets");
      const cssFiles = fs.existsSync(assetsDir)
        ? fs.readdirSync(assetsDir).filter((f) => f.endsWith(".css"))
        : [];
      if (cssFiles.length > 0) {
        filePath = path.join(assetsDir, cssFiles[0]);
      }
    } else {
      filePath = path.join(publicRoot, "index.html");
    }
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end("Internal Server Error");
      return;
    }
    const ext = path.extname(filePath);
    const contentType = CONTENT_TYPES[ext] || "text/html";

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

/**
 * Create the stateless HTTP request handler (without binding a port or starting timers).
 */
function createRequestHandler() {
  const routeHandlers = [
    handleMobileApiRoutes,
    handleAuthRoutes,
    handlePlantRoutes,
    handleSettingsRoutes,
    handleWeatherRoutes,
    handleSyncRoutes,
  ];

  return async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, token, Authorization, x-session-token");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    for (const handler of routeHandlers) {
      if (await handler(req, res, reqUrl)) {
        return;
      }
    }

    serveStaticAsset(reqUrl.pathname, res);
  };
}

/**
 * Construct an `http.Server` instance wired to all API routes and SPA static serving.
 */
function createAppServer() {
  return http.createServer(createRequestHandler());
}

module.exports = {
  createRequestHandler,
  createAppServer,
};
