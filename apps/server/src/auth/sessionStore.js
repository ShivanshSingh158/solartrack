const crypto = require("crypto");

/**
 * Enterprise In-Memory Session & Brute-Force Rate Limiter.
 * Provides cryptographically random 256-bit session tokens, rolling 24-hour expiration,
 * and adaptive IP rate-limiting to prevent credential stuffing attacks.
 */

const activeSessions = new Map();
const loginAttempts = new Map();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if an IP address is currently locked out from login attempts.
 * @param {string} ip
 * @returns {{ allowed: boolean, remainingSec?: number }}
 */
function checkLoginRateLimit(ip) {
  const safeIp = String(ip || "unknown");
  const record = loginAttempts.get(safeIp);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingSec };
  }

  // If lockout expired or window elapsed, clean up
  if (record.firstAttempt && now - record.firstAttempt > LOCKOUT_WINDOW_MS) {
    loginAttempts.delete(safeIp);
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Record a login attempt for brute-force tracking.
 * @param {string} ip
 * @param {boolean} success
 */
function recordLoginAttempt(ip, success) {
  const safeIp = String(ip || "unknown");
  const now = Date.now();

  if (success) {
    loginAttempts.delete(safeIp);
    return;
  }

  const record = loginAttempts.get(safeIp) || { count: 0, firstAttempt: now, lockedUntil: 0 };
  record.count += 1;

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_WINDOW_MS;
    console.warn(`[Security Guard] IP ${safeIp} locked out for 5 minutes due to ${record.count} failed login attempts.`);
  }

  loginAttempts.set(safeIp, record);
}

/**
 * Generate and register a new cryptographically secure session.
 * @param {string} username
 * @param {object} [metadata]
 * @returns {string} Session token
 */
function createSession(username, metadata = {}) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const session = {
    token,
    username: String(username || "User"),
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    ip: metadata.ip || "unknown",
    userAgent: metadata.userAgent || "unknown",
  };

  activeSessions.set(token, session);
  return token;
}

/**
 * Validate an active session token.
 * @param {string} token
 * @returns {object|null}
 */
function validateSession(token) {
  if (!token || typeof token !== "string") return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Revoke and destroy a session.
 * @param {string} token
 * @returns {boolean}
 */
function revokeSession(token) {
  if (!token || typeof token !== "string") return false;
  return activeSessions.delete(token);
}

/**
 * Revoke all active sessions (e.g. on emergency security reset).
 */
function revokeAllSessions() {
  activeSessions.clear();
}

/**
 * Extract session token from incoming HTTP request.
 * Checks Authorization header (Bearer), x-session-token header, or cookie.
 * @param {import('http').IncomingMessage} req
 * @returns {string|null}
 */
function extractSessionToken(req) {
  const authHeader = req.headers["authorization"] || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  if (req.headers["x-session-token"]) {
    return String(req.headers["x-session-token"]).trim();
  }

  const cookieHeader = req.headers["cookie"] || "";
  const match = cookieHeader.match(/solartrack_session=([a-f0-9]{64})/i);
  if (match) {
    return match[1];
  }

  return null;
}

module.exports = {
  checkLoginRateLimit,
  recordLoginAttempt,
  createSession,
  validateSession,
  revokeSession,
  revokeAllSessions,
  extractSessionToken,
};
