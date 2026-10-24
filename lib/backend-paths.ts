/**
 * Optional admin API paths exposed by the emulator backend.
 *
 * Aakash Dashboard is the product surface. These paths are the only
 * backend-specific hooks it uses (live health, full state reset, and the
 * captured-email inspection inbox). They are fully configurable so the
 * dashboard can target any Aakash emulator build — or a compatible backend —
 * without code changes.
 *
 * Override them with:
 *   AAKASH_BACKEND_HEALTH_PATH
 *   AAKASH_BACKEND_RESET_PATH
 *   AAKASH_BACKEND_SES_MESSAGES_PATH
 *
 * The defaults match the native admin routes of the bundled emulator engine so
 * a fresh install works out of the box. Set the variables above to move the
 * dashboard onto your own engine.
 */
function normalizePath(value: string | undefined, fallback: string): string {
  const candidate = (value && value.trim()) || fallback;
  return candidate.startsWith("/") ? candidate : `/${candidate}`;
}

const DEFAULT_BACKEND_PATHS = {
  health: "/_floci/health",
  reset: "/_floci/reset",
  sesMessages: "/_floci/ses/messages",
} as const;

export const BACKEND_PATHS = {
  health: normalizePath(process.env.AAKASH_BACKEND_HEALTH_PATH, DEFAULT_BACKEND_PATHS.health),
  reset: normalizePath(process.env.AAKASH_BACKEND_RESET_PATH, DEFAULT_BACKEND_PATHS.reset),
  sesMessages: normalizePath(
    process.env.AAKASH_BACKEND_SES_MESSAGES_PATH,
    DEFAULT_BACKEND_PATHS.sesMessages
  ),
} as const;
