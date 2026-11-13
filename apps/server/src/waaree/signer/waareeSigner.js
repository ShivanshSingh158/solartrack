const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

function fallbackMd5Signature(apiPath, token, timestamp, lang = "en") {
  const cleanPath = String(apiPath || "").split("?")[0];
  const raw = `${cleanPath}\r\n${token || ""}\r\n${lang || "en"}\r\n${timestamp}`;
  const hash = crypto.createHash("md5").update(raw).digest("hex");
  const randomInt = Math.floor(Math.random() * 1000000000);
  return `${hash}.${randomInt}`;
}

let beginSigFn = null;
let endSigFn = null;
let initPromise = null;

function initWasmSigner() {
  if (initPromise) return initPromise;
  initPromise = new Promise((resolve) => {
    try {
      const wasmPath = path.join(__dirname, "signature.wasm");
      const jsPath = path.join(__dirname, "waaree_signature.cjs");
      if (!fs.existsSync(wasmPath) || !fs.existsSync(jsPath)) {
        resolve(false);
        return;
      }
      const wasmBinary = fs.readFileSync(wasmPath);
      const code = fs.readFileSync(jsPath, "utf8");
      const moduleObj = { wasmBinary };
      const dummyModule = { exports: {} };
      const sandbox = {
        Module: moduleObj,
        module: dummyModule,
        exports: dummyModule.exports,
        __dirname,
        __filename: jsPath,
        fetch: undefined, // Force Emscripten to use synchronous wasmBinary instead of Node's URL-only fetch
        WebAssembly,
        require,
        process,
        Buffer,
        console,
        setTimeout,
        clearTimeout,
        Uint8Array,
        Int8Array,
        Uint16Array,
        Int16Array,
        Uint32Array,
        Int32Array,
        Float32Array,
        Float64Array,
        ArrayBuffer,
        DataView,
        Math,
        Date,
        Object,
        Array,
        String,
        Number,
        Boolean,
        Error,
        RangeError,
        TypeError,
        TextDecoder,
        TextEncoder,
      };
      moduleObj.onRuntimeInitialized = () => {
        try {
          beginSigFn = moduleObj.cwrap("begin_signature", "string", ["string", "string", "string", "string"]);
          endSigFn = moduleObj.cwrap("end_signature", "number", ["string"]);
          resolve(true);
        } catch (err) {
          console.warn("[WaareeSigner] cwrap failed, using fallback MD5:", err.message);
          resolve(false);
        }
      };
      vm.runInNewContext(code, sandbox, { filename: "waaree_signature.cjs" });
      if (moduleObj.calledRun && !beginSigFn && moduleObj.asm?.begin_signature) {
        beginSigFn = moduleObj.cwrap("begin_signature", "string", ["string", "string", "string", "string"]);
        endSigFn = moduleObj.cwrap("end_signature", "number", ["string"]);
        resolve(true);
      }
    } catch (err) {
      console.warn("[WaareeSigner] WASM init failed, using fallback MD5:", err.message);
      resolve(false);
    }
  });
  return initPromise;
}

// Pre-warm immediately on require
initWasmSigner().catch(() => {});

async function generateWaareeSignatureAsync(apiPath, token = "", timestamp = Date.now().toString(), lang = "en") {
  await initWasmSigner();
  return generateWaareeSignatureSync(apiPath, token, timestamp, lang);
}

function generateWaareeSignatureSync(apiPath, token = "", timestamp = Date.now().toString(), lang = "en") {
  const cleanPath = String(apiPath || "").split("?")[0];
  if (beginSigFn && endSigFn) {
    try {
      const sig = beginSigFn(cleanPath, token || "", lang || "en", String(timestamp));
      endSigFn(sig);
      if (sig && /^[a-f0-9]{32}\.\d+$/i.test(sig)) {
        return sig;
      }
    } catch (err) {
      console.warn("[WaareeSigner] WASM sign error, using fallback:", err.message);
    }
  }
  return fallbackMd5Signature(cleanPath, token, timestamp, lang);
}

module.exports = {
  initWasmSigner,
  generateWaareeSignatureAsync,
  generateWaareeSignatureSync,
};
