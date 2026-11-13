/**
 * Write a JSON response with explicit status code and Content-Type header.
 * @param {import("http").ServerResponse} res
 * @param {number} statusCode
 * @param {unknown} payload
 */
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

/**
 * Buffer and parse a JSON HTTP request body. Returns `{}` on empty body and throws
 * on malformed JSON.
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<object>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body || !body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

module.exports = {
  sendJson,
  readJsonBody,
};
