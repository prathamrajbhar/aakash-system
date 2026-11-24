import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** `scrypt:<salt>:<hash>`, both base64url. No "$", so it is safe in .env and docker compose. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("base64url")}:${scryptSync(password, salt, 64).toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltText, hashText, ...rest] = stored.split(":");
  if (scheme !== "scrypt" || !saltText || !hashText || rest.length > 0) return false;
  const expected = Buffer.from(hashText, "base64url");
  const actual = scryptSync(password, Buffer.from(saltText, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
