// Signed session cookies for password mode. Web Crypto only, so it runs in the Edge middleware.

export const SESSION_COOKIE = "aakash_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();

async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
  return Array.from(mac, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `<expiry-unix-seconds>.<hmac>` */
export async function createSession(secret: string, now = Date.now()): Promise<string> {
  const expires = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  return `${expires}.${await sign(secret, `v1.${expires}`)}`;
}

export async function verifySession(secret: string, token: string, now = Date.now()): Promise<boolean> {
  const [expiresText, signature, ...rest] = token.split(".");
  if (rest.length > 0 || !expiresText || !signature || !/^\d+$/.test(expiresText)) return false;
  if (Number(expiresText) <= Math.floor(now / 1000)) return false;
  return timingSafeEqual(signature, await sign(secret, `v1.${expiresText}`));
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}
