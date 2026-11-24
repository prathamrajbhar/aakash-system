// Pure request-policy helpers for the Aakash gateway. No I/O, so they are easy to test.

import fs from "node:fs";

/** AWS access key IDs are 16-128 word characters. Anything shorter (e.g. the dev key "test") is refused. */
const MIN_KEY_ID_LENGTH = 16;
const VALID_KEY_ID = /^\w{16,128}$/;

/**
 * Normalizes a raw request target into path segments the way a lenient upstream
 * would read it, so a block-list check cannot be bypassed with encoded or
 * doubled separators (`//_floci`, `/%5Ffloci`, `/a/../_floci`, `/\_floci`).
 * Returns null when the target is malformed or tries to traverse.
 */
/** @param {string} rawUrl @returns {string[] | null} */
export function pathSegments(rawUrl) {
  // Only origin-form targets ("/path?query") are served; absolute-form targets are refused.
  // A leading "//" is kept on purpose: it is a valid path that collapses to "/..." below.
  if (typeof rawUrl !== "string" || !rawUrl.startsWith("/")) return null;
  const rawPath = rawUrl.split("?")[0].split("#")[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const segments = decoded
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".");
  if (segments.some((segment) => segment === "..")) return null;
  return segments;
}

/** Emulator admin/control paths (`/_floci/...`, `/_localstack/...`, `/q/...`) are never public. */
/** @param {string[]} segments */
export function isBlockedPath(segments) {
  if (segments.length === 0) return false;
  const first = segments[0].toLowerCase();
  // S3 bucket names cannot start with "_" and AWS APIs never use such a path,
  // so any underscore-prefixed first segment is an internal/admin endpoint.
  return first.startsWith("_") || first === "q" || first === "actuator";
}

/**
 * Reads the access key ID a SigV4 request claims to use. An `Authorization`
 * header takes precedence over a presigned query string, matching the emulator.
 * Anything that is not SigV4 yields null.
 */
/** @param {Record<string, string | string[] | undefined>} headers @param {URLSearchParams} searchParams @returns {string | null} */
export function extractAccessKeyId(headers, searchParams) {
  const authorization = headers["authorization"];
  if (typeof authorization === "string" && authorization.trim() !== "") {
    const match = /^AWS4-HMAC-SHA256\s+Credential=([^/\s,]+)\//i.exec(authorization.trim());
    return match ? match[1] : null;
  }
  const credential = searchParams.get("X-Amz-Credential");
  if (credential) {
    const match = /^([^/]+)\//.exec(credential);
    return match ? match[1] : null;
  }
  return null;
}

/** Keeps only well-formed, non-weak key IDs. Never lets the dev key "test" in. */
/** @param {unknown[]} ids */
export function sanitizeKeyIds(ids) {
  return new Set(
    ids
      .map((id) => String(id).trim())
      .filter((id) => id.length >= MIN_KEY_ID_LENGTH && VALID_KEY_ID.test(id))
  );
}

/**
 * Allow-list of access key IDs, from an env list plus an optional JSON file
 * (`{ "keys": [{ "accessKeyId": "AKIA..." }] }`) that is re-read when it changes,
 * so keys created in the dashboard work without restarting the gateway.
 */
export class KeyStore {
  /**
   * @param {{ envKeyIds?: string[], keysFile?: string | null, onWarn?: (message: string) => void }} [options]
   */
  constructor({ envKeyIds = [], keysFile = null, onWarn = () => {} } = {}) {
    this.envKeys = sanitizeKeyIds(envKeyIds);
    this.keysFile = keysFile;
    this.onWarn = onWarn;
    this.fileKeys = new Set();
    this.fileMtimeMs = -1;
    if (envKeyIds.length > this.envKeys.size) {
      onWarn("Ignored invalid or weak access key IDs in GATEWAY_ACCESS_KEY_IDS.");
    }
  }

  refresh() {
    if (!this.keysFile) return;
    let stat;
    try {
      stat = fs.statSync(this.keysFile);
    } catch {
      this.fileKeys = new Set();
      this.fileMtimeMs = -1;
      return;
    }
    if (stat.mtimeMs === this.fileMtimeMs) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.keysFile, "utf-8"));
      const ids = Array.isArray(parsed?.keys) ? parsed.keys.map((key) => key?.accessKeyId).filter(Boolean) : [];
      this.fileKeys = sanitizeKeyIds(ids);
      this.fileMtimeMs = stat.mtimeMs;
      if (ids.length > this.fileKeys.size) this.onWarn("Ignored invalid or weak access key IDs in the keys file.");
    } catch {
      // A half-written file keeps the previous allow-list until the next valid write.
      this.onWarn("Could not parse the keys file; keeping the previous allow-list.");
    }
  }

  has(accessKeyId) {
    this.refresh();
    return this.envKeys.has(accessKeyId) || this.fileKeys.has(accessKeyId);
  }

  get size() {
    this.refresh();
    return new Set([...this.envKeys, ...this.fileKeys]).size;
  }
}

/** Query parameters an anonymous public-file read may carry. All others are dropped. */
const PUBLIC_QUERY_ALLOW = ["versionId", "response-content-type", "response-content-disposition", "response-cache-control"];

/**
 * Builds the upstream target for an anonymous public-file read, or null when the
 * request must be refused. Only `/<bucket>/<key>` is allowed: no bucket-level
 * paths (listing) and no S3 sub-resources such as `?acl` or `?tagging`.
 */
/** @param {string} rawUrl @returns {string | null} */
export function publicFileTarget(rawUrl) {
  const segments = pathSegments(rawUrl);
  if (!segments || segments.length < 2 || isBlockedPath(segments)) return null;
  const rawPath = rawUrl.split("?")[0].split("#")[0];
  const search = new URLSearchParams(rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?") + 1) : "");
  const kept = new URLSearchParams();
  for (const name of PUBLIC_QUERY_ALLOW) {
    const value = search.get(name);
    if (value !== null) kept.set(name, value);
  }
  const query = kept.toString();
  return query ? `${rawPath}?${query}` : rawPath;
}
