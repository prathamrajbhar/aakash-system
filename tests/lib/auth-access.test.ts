import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet, type JWTVerifyGetKey } from "jose";
import { authorizeRequest, isSameOriginRequest } from "@/lib/auth/access";
import { readAuthConfig, isResetAllowed, normalizeTeamDomain } from "@/lib/auth/config";

const TEAM = "https://team.cloudflareaccess.com";
const AUD = "aud-tag-123";

let keySet: JWTVerifyGetKey;
let sign: (claims?: Record<string, unknown>, opts?: { iss?: string; aud?: string; exp?: string }) => Promise<string>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  keySet = createLocalJWKSet({ keys: [jwk] });
  sign = (claims = { email: "me@example.com" }, opts = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(opts.iss ?? TEAM)
      .setAudience(opts.aud ?? AUD)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "5m")
      .sign(privateKey);
});

const cfConfig = (over: Partial<ReturnType<typeof readAuthConfig>> = {}) => ({
  ...readAuthConfig({ AAKASH_AUTH_MODE: "cloudflare", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD }),
  ...over,
});

const req = (headers: Record<string, string> = {}, method = "GET") => ({
  method,
  headers: new Headers(headers),
});

describe("readAuthConfig", () => {
  it("defaults to none for local installs", () => {
    expect(readAuthConfig({}).mode).toBe("none");
    expect(readAuthConfig({ AAKASH_AUTH_MODE: "none" }).mode).toBe("none");
  });

  it("fails closed on an unknown mode instead of disabling auth", () => {
    expect(readAuthConfig({ AAKASH_AUTH_MODE: "cloudfare" }).mode).toBe("invalid");
  });

  it("normalizes the team domain and lists", () => {
    expect(normalizeTeamDomain("team.cloudflareaccess.com/")).toBe(TEAM);
    expect(normalizeTeamDomain("https://team.cloudflareaccess.com/cdn-cgi")).toBe(TEAM);
    expect(normalizeTeamDomain("")).toBeNull();
    const cfg = readAuthConfig({ AAKASH_ALLOWED_EMAILS: "A@x.com, b@x.com ", AAKASH_ALLOWED_ORIGINS: "https://a.example.com/" });
    expect(cfg.allowedEmails).toEqual(["a@x.com", "b@x.com"]);
    expect(cfg.extraOrigins).toEqual(["https://a.example.com"]);
  });
});

describe("isResetAllowed", () => {
  it("is on for local installs and off for public ones", () => {
    expect(isResetAllowed({})).toBe(true);
    expect(isResetAllowed({ AAKASH_AUTH_MODE: "cloudflare" })).toBe(false);
  });

  it("honours an explicit override either way", () => {
    expect(isResetAllowed({ AAKASH_AUTH_MODE: "cloudflare", AAKASH_ALLOW_RESET: "true" })).toBe(true);
    expect(isResetAllowed({ AAKASH_ALLOW_RESET: "false" })).toBe(false);
  });
});

describe("authorizeRequest", () => {
  it("allows everything in none mode", async () => {
    const result = await authorizeRequest(req(), readAuthConfig({}));
    expect(result).toEqual({ ok: true, email: null });
  });

  it("returns 503 for an invalid mode and for missing Cloudflare settings", async () => {
    expect(await authorizeRequest(req(), readAuthConfig({ AAKASH_AUTH_MODE: "oops" }))).toMatchObject({ ok: false, status: 503 });
    expect(await authorizeRequest(req(), readAuthConfig({ AAKASH_AUTH_MODE: "cloudflare" }))).toMatchObject({ ok: false, status: 503 });
  });

  it("rejects a request with no token", async () => {
    expect(await authorizeRequest(req(), cfConfig(), keySet)).toMatchObject({ ok: false, status: 401 });
  });

  it("accepts a valid token and returns the lower-cased email", async () => {
    const token = await sign({ email: "Me@Example.com" });
    const result = await authorizeRequest(req({ "cf-access-jwt-assertion": token }), cfConfig(), keySet);
    expect(result).toEqual({ ok: true, email: "me@example.com" });
  });

  it("rejects garbage, wrong audience, wrong issuer and expired tokens", async () => {
    const bad = [
      "not-a-jwt",
      await sign({ email: "me@example.com" }, { aud: "other-app" }),
      await sign({ email: "me@example.com" }, { iss: "https://evil.cloudflareaccess.com" }),
      await sign({ email: "me@example.com" }, { exp: "-1m" }),
    ];
    for (const token of bad) {
      const result = await authorizeRequest(req({ "cf-access-jwt-assertion": token }), cfConfig(), keySet);
      expect(result).toMatchObject({ ok: false, status: 401 });
    }
  });

  it("rejects a token signed by a key that is not in the Cloudflare key set", async () => {
    const other = await generateKeyPair("RS256");
    const forged = await new SignJWT({ email: "me@example.com" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(TEAM)
      .setAudience(AUD)
      .setExpirationTime("5m")
      .sign(other.privateKey);
    const result = await authorizeRequest(req({ "cf-access-jwt-assertion": forged }), cfConfig(), keySet);
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("enforces the optional email allow-list, including for tokens with no email", async () => {
    const config = cfConfig({ allowedEmails: ["me@example.com"] });
    const allowed = await sign({ email: "me@example.com" });
    const denied = await sign({ email: "other@example.com" });
    const service = await sign({ common_name: "service-token-id" });
    expect(await authorizeRequest(req({ "cf-access-jwt-assertion": allowed }), config, keySet)).toMatchObject({ ok: true });
    expect(await authorizeRequest(req({ "cf-access-jwt-assertion": denied }), config, keySet)).toMatchObject({ ok: false, status: 403 });
    expect(await authorizeRequest(req({ "cf-access-jwt-assertion": service }), config, keySet)).toMatchObject({ ok: false, status: 403 });
  });

  it("blocks cross-origin writes but allows same-origin and non-browser writes", async () => {
    const token = await sign();
    const base = { "cf-access-jwt-assertion": token, host: "aakash.example.com" };
    const cross = await authorizeRequest(req({ ...base, origin: "https://evil.example" }, "POST"), cfConfig(), keySet);
    const same = await authorizeRequest(req({ ...base, origin: "https://aakash.example.com" }, "POST"), cfConfig(), keySet);
    const noOrigin = await authorizeRequest(req(base, "DELETE"), cfConfig(), keySet);
    expect(cross).toMatchObject({ ok: false, status: 403, code: "CrossOriginBlocked" });
    expect(same).toMatchObject({ ok: true });
    expect(noOrigin).toMatchObject({ ok: true });
  });
});

describe("isSameOriginRequest", () => {
  it("handles forwarded hosts, opaque origins and malformed values", () => {
    expect(isSameOriginRequest(new Headers({ origin: "https://a.example.com", "x-forwarded-host": "a.example.com" }))).toBe(true);
    expect(isSameOriginRequest(new Headers({ origin: "null", host: "a.example.com" }))).toBe(false);
    expect(isSameOriginRequest(new Headers({ origin: "::bad::", host: "a.example.com" }))).toBe(false);
    expect(isSameOriginRequest(new Headers({ origin: "https://b.example.com", host: "a.example.com" }), ["https://b.example.com"])).toBe(true);
  });
});
