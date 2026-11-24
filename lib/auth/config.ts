/**
 * Authentication configuration for the Aakash dashboard.
 *
 * Modes (AAKASH_AUTH_MODE):
 *   none        Local use. Every request is allowed. Default, so existing local
 *               installs keep working. Do NOT expose the dashboard publicly in
 *               this mode.
 *   cloudflare  Public use behind Cloudflare Access. Every request must carry a
 *               valid `Cf-Access-Jwt-Assertion` token issued for this app.
 *
 * Any other value is treated as a misconfiguration and fails closed, so a typo
 * such as "cloudfare" can never silently turn authentication off.
 */

export type AuthMode = "none" | "cloudflare" | "invalid";

export interface AuthConfig {
  mode: AuthMode;
  /** Origin of the Access team domain, e.g. https://myteam.cloudflareaccess.com */
  teamDomain: string | null;
  /** Application Audience (AUD) tag of the Access application. */
  audience: string | null;
  /** Optional extra allow-list applied on top of the Access policy (lower-cased). */
  allowedEmails: string[];
  /** Extra origins accepted for browser write requests (besides the request's own host). */
  extraOrigins: string[];
}

type Env = Record<string, string | undefined>;

/** Accepts `team.cloudflareaccess.com` or a full URL and returns the bare origin. */
export function normalizeTeamDomain(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin;
  } catch {
    return null;
  }
}

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readAuthConfig(env: Env = process.env): AuthConfig {
  const rawMode = (env.AAKASH_AUTH_MODE ?? "").trim().toLowerCase();
  const mode: AuthMode =
    rawMode === "" || rawMode === "none"
      ? "none"
      : rawMode === "cloudflare"
        ? "cloudflare"
        : "invalid";

  return {
    mode,
    teamDomain: normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN),
    audience: env.CF_ACCESS_AUD?.trim() || null,
    allowedEmails: splitList(env.AAKASH_ALLOWED_EMAILS).map((email) => email.toLowerCase()),
    extraOrigins: splitList(env.AAKASH_ALLOWED_ORIGINS).map((origin) => origin.replace(/\/+$/, "")),
  };
}

/**
 * Whether the destructive "reset all emulator state" action is available.
 * An explicit AAKASH_ALLOW_RESET always wins. Otherwise it is enabled only for
 * local (unauthenticated) installs and disabled for public deployments.
 */
export function isResetAllowed(env: Env = process.env): boolean {
  const explicit = env.AAKASH_ALLOW_RESET?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return readAuthConfig(env).mode === "none";
}
