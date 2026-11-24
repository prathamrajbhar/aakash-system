// Aakash gateway: the only component exposed to the internet for the AWS API.
//
// The emulator itself accepts unsigned requests, the default "test" key, and
// serves admin endpoints (/_floci/...). This gateway sits in front of it and:
//   * API host    - requires a SigV4-signed request from an allow-listed access
//                   key, and hides admin paths. The emulator then verifies the
//                   signature itself (FLOCI_AUTH_VALIDATE_SIGNATURES=true).
//   * Files host  - serves anonymous GET/HEAD for /<bucket>/<key> only. The
//                   emulator decides what is public through S3 bucket policies.
//
// It streams bodies (no buffering), preserves the Host header (SigV4 signs it)
// and has no runtime dependencies.

import http from "node:http";
import { pathToFileURL } from "node:url";
import { KeyStore, extractAccessKeyId, isBlockedPath, pathSegments, publicFileTarget } from "./policy.mjs";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
  "expect",
]);

const PUBLIC_REQUEST_HEADERS = new Set([
  "host",
  "range",
  "if-match",
  "if-none-match",
  "if-modified-since",
  "if-unmodified-since",
  "accept",
  "accept-encoding",
  "user-agent",
]);

/** Content a browser would execute if served from the files origin. */
const ACTIVE_CONTENT = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|(text|application)\/javascript)\b/i;

function deny(req, res, status, code, message) {
  const contentType = String(req.headers["content-type"] || "");
  if (/^application\/x-amz-json/i.test(contentType)) {
    res.writeHead(status, { "Content-Type": "application/x-amz-json-1.0", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify({ __type: code, message }));
    return;
  }
  res.writeHead(status, { "Content-Type": "application/xml", "X-Content-Type-Options": "nosniff" });
  res.end(
    `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${message}</Message></Error>`
  );
}

function hostOf(req) {
  return String(req.headers.host || "").split(":")[0].toLowerCase();
}

/**
 * @param {object} options
 * @param {string} options.upstream            Emulator base URL, e.g. http://aakash:4566
 * @param {KeyStore} options.keys              Allowed access key IDs
 * @param {string|null} [options.filesHost]    Hostname that serves anonymous public files
 * @param {(entry: Record<string, unknown>) => void} [options.log]
 */
export function createGateway({ upstream, keys, filesHost = null, log = () => {} }) {
  const target = new URL(upstream);
  const agent = new http.Agent({ keepAlive: true, maxSockets: 256 });
  const normalizedFilesHost = filesHost ? filesHost.toLowerCase() : null;

  function forward(req, res, { path, headers, isPublic, startedAt, keyId }) {
    let upstreamDone = false;
    const upstreamReq = http.request(
      {
        agent,
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 80,
        method: req.method,
        path,
        headers,
      },
      (upstreamRes) => {
        const responseHeaders = { ...upstreamRes.headers };
        delete responseHeaders["set-cookie"];
        for (const name of Object.keys(responseHeaders)) {
          if (HOP_BY_HOP.has(name)) delete responseHeaders[name];
        }
        if (isPublic) {
          responseHeaders["x-content-type-options"] = "nosniff";
          if (ACTIVE_CONTENT.test(String(responseHeaders["content-type"] || ""))) {
            responseHeaders["content-security-policy"] = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";
          }
        }
        res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
        upstreamRes.pipe(res);
        upstreamRes.on("end", () => {
          upstreamDone = true;
          log({ method: req.method, path: path.split("?")[0], status: upstreamRes.statusCode, ms: Date.now() - startedAt, key: keyId, public: isPublic });
        });
      }
    );

    upstreamReq.on("error", () => {
      if (!res.headersSent) deny(req, res, 502, "ServiceUnavailable", "The emulator is not reachable.");
      else res.destroy();
    });
    // A client that disconnects mid-transfer must not leave the upstream request running.
    res.on("close", () => {
      if (!upstreamDone) upstreamReq.destroy();
    });
    req.pipe(upstreamReq);
  }

  return http.createServer((req, res) => {
    const startedAt = Date.now();
    const rawUrl = req.url || "";

    if (rawUrl === "/__gateway/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"status":"ok"}');
      return;
    }

    const segments = pathSegments(rawUrl);
    if (!segments) return deny(req, res, 400, "InvalidURI", "Couldn't parse the specified URI.");
    if (isBlockedPath(segments)) return deny(req, res, 404, "NotFound", "Not found.");

    // ---- Anonymous public files ------------------------------------------------
    if (normalizedFilesHost && hostOf(req) === normalizedFilesHost) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return deny(req, res, 405, "MethodNotAllowed", "Only GET and HEAD are allowed here.");
      }
      const publicPath = publicFileTarget(rawUrl);
      if (!publicPath) return deny(req, res, 404, "NoSuchKey", "The specified key does not exist.");
      const headers = {};
      for (const [name, value] of Object.entries(req.headers)) {
        if (PUBLIC_REQUEST_HEADERS.has(name)) headers[name] = value;
      }
      // Anonymous requests are not signed, so Host can be rewritten. Left as the
      // public name, the emulator may read "files.<suffix>" as a virtual-hosted
      // bucket called "files" instead of treating the path as /<bucket>/<key>.
      headers.host = target.host;
      return forward(req, res, { path: publicPath, headers, isPublic: true, startedAt, keyId: null });
    }

    // ---- Authenticated AWS API -------------------------------------------------
    // CORS preflight carries no credentials by design; the emulator answers it
    // from the bucket's CORS rules and it exposes no data.
    if (req.method !== "OPTIONS") {
      const queryStart = rawUrl.indexOf("?");
      const search = new URLSearchParams(queryStart === -1 ? "" : rawUrl.slice(queryStart + 1).split("#")[0]);
      const keyId = extractAccessKeyId(req.headers, search);
      if (!keyId) {
        return deny(req, res, 403, "AccessDenied", "Request must be signed with AWS Signature Version 4.");
      }
      if (!keys.has(keyId)) {
        return deny(req, res, 403, "InvalidAccessKeyId", "The AWS Access Key Id you provided does not exist in our records.");
      }
      return forward(req, res, { path: rawUrl, headers: stripHopByHop(req.headers), isPublic: false, startedAt, keyId: keyId.slice(-4) });
    }
    return forward(req, res, { path: rawUrl, headers: stripHopByHop(req.headers), isPublic: false, startedAt, keyId: null });
  });
}

function stripHopByHop(headers) {
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!HOP_BY_HOP.has(name)) result[name] = value;
  }
  return result;
}

function listFromEnv(value) {
  return (value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function main() {
  const upstream = process.env.GATEWAY_UPSTREAM || "http://aakash:4566";
  const port = Number.parseInt(process.env.GATEWAY_PORT || "4567", 10);
  const logLine = (entry) => console.log(JSON.stringify({ t: new Date().toISOString(), ...entry }));
  const keys = new KeyStore({
    envKeyIds: listFromEnv(process.env.GATEWAY_ACCESS_KEY_IDS),
    keysFile: process.env.GATEWAY_KEYS_FILE || null,
    onWarn: (message) => logLine({ level: "warn", message }),
  });

  const server = createGateway({
    upstream,
    keys,
    filesHost: process.env.GATEWAY_FILES_HOST || null,
    log: logLine,
  });
  server.headersTimeout = 30_000;
  server.requestTimeout = 0; // large uploads stream for as long as they need
  server.keepAliveTimeout = 65_000;

  server.listen(port, "0.0.0.0", () => {
    logLine({ level: "info", message: `gateway listening on :${port}`, upstream, allowedKeys: keys.size });
    if (keys.size === 0) logLine({ level: "warn", message: "No access keys are allowed yet: every API request will be refused." });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
