import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AuthConfig } from "./config";
import { SESSION_COOKIE, readCookie, verifySession } from "./session";

/** Header Cloudflare Access adds to every request it forwards to the origin. */
export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

export type AuthResult =
  | { ok: true; email: string | null }
  | { ok: false; status: 401 | 403 | 503; code: string; message: string };

interface AuthRequest {
  method: string;
  headers: Headers;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// One remote key set per team domain; jose caches and rotates the keys itself.
const keySets = new Map<string, JWTVerifyGetKey>();

function getKeySet(teamDomain: string): JWTVerifyGetKey {
  let keySet = keySets.get(teamDomain);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    keySets.set(teamDomain, keySet);
  }
  return keySet;
}

/**
 * Browser write requests must come from this site. Requests without an Origin
 * header (curl, SDKs, service tokens) are not browser-driven, so they pass here
 * and are still subject to token verification.
 */
export function isSameOriginRequest(headers: Headers, extraOrigins: string[] = []): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  if (origin === "null") return false;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const hosts = [headers.get("host"), headers.get("x-forwarded-host")]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.split(",")[0].trim().toLowerCase());

  return (
    hosts.includes(originUrl.host.toLowerCase()) ||
    extraOrigins.some((allowed) => allowed.toLowerCase() === originUrl.origin.toLowerCase())
  );
}

/**
 * Decides whether a request may reach the dashboard. Fails closed: any problem
 * with the configuration or the token denies the request.
 *
 * `keySet` is injectable so tests can verify tokens without network access.
 */
export async function authorizeRequest(
  request: AuthRequest,
  config: AuthConfig,
  keySet?: JWTVerifyGetKey
): Promise<AuthResult> {
  if (config.mode === "none") return { ok: true, email: null };

  if (config.mode === "password") {
    if (!config.passwordHash || !config.sessionSecret || config.sessionSecret.length < 32) {
      return {
        ok: false,
        status: 503,
        code: "AuthMisconfigured",
        message: "AAKASH_PASSWORD_HASH and a 32+ character AAKASH_SESSION_SECRET must be set when AAKASH_AUTH_MODE=password.",
      };
    }
    const session = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
    if (!session || !(await verifySession(config.sessionSecret, session))) {
      return { ok: false, status: 401, code: "LoginRequired", message: "Login required." };
    }
    if (!SAFE_METHODS.has(request.method.toUpperCase()) && !isSameOriginRequest(request.headers, config.extraOrigins)) {
      return { ok: false, status: 403, code: "CrossOriginBlocked", message: "Cross-origin write request blocked." };
    }
    return { ok: true, email: null };
  }

  if (config.mode === "invalid") {
    return {
      ok: false,
      status: 503,
      code: "AuthMisconfigured",
      message: "AAKASH_AUTH_MODE is invalid. Use \"none\", \"cloudflare\" or \"password\".",
    };
  }

  if (!config.teamDomain || !config.audience) {
    return {
      ok: false,
      status: 503,
      code: "AuthMisconfigured",
      message: "CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD must be set when AAKASH_AUTH_MODE=cloudflare.",
    };
  }

  const token = request.headers.get(ACCESS_JWT_HEADER);
  if (!token) {
    return { ok: false, status: 401, code: "Unauthorized", message: "Cloudflare Access login required." };
  }

  let email: string | null;
  try {
    const { payload } = await jwtVerify(token, keySet ?? getKeySet(config.teamDomain), {
      issuer: config.teamDomain,
      audience: config.audience,
    });
    email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  } catch {
    // Do not reveal why verification failed.
    return { ok: false, status: 401, code: "Unauthorized", message: "Invalid or expired access token." };
  }

  if (config.allowedEmails.length > 0 && (!email || !config.allowedEmails.includes(email))) {
    return { ok: false, status: 403, code: "Forbidden", message: "This account is not allowed to use Aakash." };
  }

  if (!SAFE_METHODS.has(request.method.toUpperCase()) && !isSameOriginRequest(request.headers, config.extraOrigins)) {
    return { ok: false, status: 403, code: "CrossOriginBlocked", message: "Cross-origin write request blocked." };
  }

  return { ok: true, email };
}
