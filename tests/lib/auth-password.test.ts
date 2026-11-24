import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, verifySession, readCookie, SESSION_COOKIE } from "@/lib/auth/session";
import { authorizeRequest } from "@/lib/auth/access";
import { readAuthConfig } from "@/lib/auth/config";
import { POST as login } from "@/app/api/auth/login/route";

const SECRET = "s".repeat(40);
const PASSWORD = "correct horse battery";
const HASH = hashPassword(PASSWORD);
const env = { AAKASH_AUTH_MODE: "password", AAKASH_PASSWORD_HASH: HASH, AAKASH_SESSION_SECRET: SECRET };

describe("password hashing", () => {
  it("verifies the right password only, with a salted hash free of '$'", () => {
    expect(HASH).toMatch(/^scrypt:[\w-]+:[\w-]+$/);
    expect(HASH).not.toContain("$");
    expect(hashPassword(PASSWORD)).not.toBe(HASH);
    expect(verifyPassword(PASSWORD, HASH)).toBe(true);
    expect(verifyPassword("wrong", HASH)).toBe(false);
    expect(verifyPassword(PASSWORD, "garbage")).toBe(false);
    expect(verifyPassword(PASSWORD, "scrypt:a")).toBe(false);
  });
});

describe("session cookies", () => {
  it("accepts a fresh token and rejects tampered, expired and foreign-secret ones", async () => {
    const now = Date.now();
    const token = await createSession(SECRET, now);
    expect(await verifySession(SECRET, token, now)).toBe(true);
    expect(await verifySession(SECRET, token, now + 13 * 3600 * 1000)).toBe(false);
    expect(await verifySession("o".repeat(40), token, now)).toBe(false);
    const [exp, sig] = token.split(".");
    expect(await verifySession(SECRET, `${Number(exp) + 99999}.${sig}`, now)).toBe(false);
    expect(await verifySession(SECRET, "nope", now)).toBe(false);
    expect(await verifySession(SECRET, `${exp}.${sig}.x`, now)).toBe(false);
  });

  it("reads a named cookie", () => {
    expect(readCookie("a=1; aakash_session=tok; b=2", SESSION_COOKIE)).toBe("tok");
    expect(readCookie(null, SESSION_COOKIE)).toBeNull();
    expect(readCookie("x=1", SESSION_COOKIE)).toBeNull();
  });
});

describe("authorizeRequest in password mode", () => {
  const req = (headers: Record<string, string> = {}, method = "GET") => ({ method, headers: new Headers(headers) });

  it("fails closed when misconfigured or the secret is short", async () => {
    expect(await authorizeRequest(req(), readAuthConfig({ AAKASH_AUTH_MODE: "password" }))).toMatchObject({ status: 503 });
    expect(await authorizeRequest(req(), readAuthConfig({ ...env, AAKASH_SESSION_SECRET: "short" }))).toMatchObject({ status: 503 });
  });

  it("requires a valid session, and blocks cross-origin writes", async () => {
    const config = readAuthConfig(env);
    expect(await authorizeRequest(req(), config)).toMatchObject({ ok: false, status: 401, code: "LoginRequired" });
    expect(await authorizeRequest(req({ cookie: `${SESSION_COOKIE}=1.bad` }), config)).toMatchObject({ ok: false, status: 401 });
    const cookie = `${SESSION_COOKIE}=${await createSession(SECRET)}`;
    expect(await authorizeRequest(req({ cookie }), config)).toMatchObject({ ok: true });
    expect(await authorizeRequest(req({ cookie, host: "a.example.com", origin: "https://evil.example" }, "POST"), config)).toMatchObject({ ok: false, status: 403 });
    expect(await authorizeRequest(req({ cookie, host: "a.example.com", origin: "https://a.example.com" }, "POST"), config)).toMatchObject({ ok: true });
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => Object.assign(process.env, env));
  const post = (body: unknown, ip = "9.9.9.9") =>
    login(new NextRequest("https://aakash.example.com/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", host: "aakash.example.com", "cf-connecting-ip": ip, "x-forwarded-proto": "https" },
      body: JSON.stringify(body),
    }));

  it("sets a secure HttpOnly session cookie for the right password", async () => {
    const res = await post({ password: PASSWORD }, "1.1.1.1");
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("secure");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
  });

  it("rejects a wrong password, then locks the IP out after repeated failures", async () => {
    for (let i = 0; i < 5; i++) expect((await post({ password: "nope" }, "2.2.2.2")).status).toBe(401);
    expect((await post({ password: PASSWORD }, "2.2.2.2")).status).toBe(429);
    expect((await post({ password: PASSWORD }, "3.3.3.3")).status).toBe(200);
  }, 15000);

  it("is disabled outside password mode", async () => {
    process.env.AAKASH_AUTH_MODE = "none";
    expect((await post({ password: PASSWORD })).status).toBe(404);
  });
});
