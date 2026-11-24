import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createGateway } from "@/gateway/server.mjs";
import { KeyStore, extractAccessKeyId, isBlockedPath, pathSegments, publicFileTarget, sanitizeKeyIds } from "@/gateway/policy.mjs";

const GOOD_KEY = "AKIAGOODKEY0000001";
const sig = (key: string) =>
  `AWS4-HMAC-SHA256 Credential=${key}/20260101/us-east-1/s3/aws4_request, SignedHeaders=host, Signature=abc`;

describe("policy helpers", () => {
  it("collapses encoded and doubled separators so admin paths cannot hide", () => {
    for (const raw of ["/_floci/reset", "//_floci/reset", "/%5Ffloci/reset", "/./_floci", "/\\_floci/x", "/_localstack/health", "/q/health"]) {
      const segments = pathSegments(raw);
      expect(segments, raw).not.toBeNull();
      expect(isBlockedPath(segments!), raw).toBe(true);
    }
  });

  it("rejects traversal, bad encodings and absolute-form targets", () => {
    for (const raw of ["/a/../_floci", "/%2e%2e/x", "/%E0%A4%A", "/a%00b", "http://evil/x", "x"]) {
      expect(pathSegments(raw), raw).toBeNull();
    }
  });

  it("does not block normal S3 and API paths", () => {
    for (const raw of ["/", "/my-bucket", "/my-bucket/key/with/slash.txt", "/my-bucket?list-type=2"]) {
      expect(isBlockedPath(pathSegments(raw)!), raw).toBe(false);
    }
  });

  it("reads the key id from the Authorization header, which wins over a presigned query", () => {
    expect(extractAccessKeyId({ authorization: sig(GOOD_KEY) }, new URLSearchParams())).toBe(GOOD_KEY);
    expect(extractAccessKeyId({}, new URLSearchParams({ "X-Amz-Credential": `${GOOD_KEY}/20260101/us-east-1/s3/aws4_request` }))).toBe(GOOD_KEY);
    expect(
      extractAccessKeyId({ authorization: sig("AKIAHEADERKEY000001") }, new URLSearchParams({ "X-Amz-Credential": "test/x/y/z" }))
    ).toBe("AKIAHEADERKEY000001");
    expect(extractAccessKeyId({ authorization: "Bearer abc" }, new URLSearchParams())).toBeNull();
    expect(extractAccessKeyId({ authorization: "AWS test:sig" }, new URLSearchParams())).toBeNull();
    expect(extractAccessKeyId({}, new URLSearchParams())).toBeNull();
  });

  it("refuses weak key ids such as the dev key", () => {
    expect([...sanitizeKeyIds(["test", "floci", "short", GOOD_KEY, "has space 1234567890"])]).toEqual([GOOD_KEY]);
  });

  it("only exposes /<bucket>/<key> for public files and drops sub-resource queries", () => {
    expect(publicFileTarget("/b/img/a.png")).toBe("/b/img/a.png");
    expect(publicFileTarget("/b/a.png?acl")).toBe("/b/a.png");
    expect(publicFileTarget("/b/a.png?tagging&versionId=3&x=1")).toBe("/b/a.png?versionId=3");
    expect(publicFileTarget("/b")).toBeNull();
    expect(publicFileTarget("/")).toBeNull();
    expect(publicFileTarget("/_floci/health")).toBeNull();
  });
});

describe("KeyStore", () => {
  it("picks up keys written to the file without a restart", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gw-keys-")), "api-keys.json");
    const store = new KeyStore({ keysFile: file });
    expect(store.has(GOOD_KEY)).toBe(false);
    fs.writeFileSync(file, JSON.stringify({ keys: [{ accessKeyId: GOOD_KEY }, { accessKeyId: "test" }] }));
    fs.utimesSync(file, new Date(), new Date(Date.now() + 5000));
    expect(store.has(GOOD_KEY)).toBe(true);
    expect(store.has("test")).toBe(false);
    fs.writeFileSync(file, "{ not json");
    fs.utimesSync(file, new Date(), new Date(Date.now() + 10000));
    expect(store.has(GOOD_KEY)).toBe(true); // keeps the last good list
  });
});

describe("gateway", () => {
  interface Seen { method?: string; url?: string; headers: http.IncomingHttpHeaders; body: string }
  let upstream: http.Server;
  let gateway: http.Server;
  let base: string;
  let seen: Seen[] = [];

  beforeAll(async () => {
    upstream = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        seen.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
        res.writeHead(200, { "Content-Type": "text/html", "Set-Cookie": "leak=1", "X-Upstream": "yes" });
        res.end(`echo:${req.method}:${req.url}`);
      });
    });
    await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
    const upstreamPort = (upstream.address() as AddressInfo).port;

    gateway = createGateway({
      upstream: `http://127.0.0.1:${upstreamPort}`,
      keys: new KeyStore({ envKeyIds: [GOOD_KEY] }),
      filesHost: "files.example.com",
    });
    await new Promise<void>((r) => gateway.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    gateway.closeAllConnections();
    upstream.closeAllConnections();
    await Promise.all([new Promise((r) => gateway.close(r)), new Promise((r) => upstream.close(r))]);
  });

  interface Reply { status: number; headers: http.IncomingHttpHeaders; text(): Promise<string>; json(): Promise<unknown> }

  // node:http (not fetch) so tests control the Host header, which SigV4 and host routing depend on.
  const call = (p: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Reply> => {
    seen = [];
    const url = new URL(base);
    return new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: url.hostname, port: url.port, path: p, method: init.method ?? "GET", headers: init.headers, agent: false },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString();
            resolve({ status: res.statusCode ?? 0, headers: res.headers, text: async () => body, json: async () => JSON.parse(body) });
          });
        }
      );
      req.on("error", reject);
      if (init.body !== undefined) req.write(init.body);
      req.end();
    });
  };

  it("refuses unsigned requests, which the emulator itself would serve", async () => {
    const res = await call("/");
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("AccessDenied");
    expect(seen).toHaveLength(0);
  });

  it("refuses the default dev key and unknown keys without contacting the emulator", async () => {
    for (const key of ["test", "AKIAUNKNOWNKEY000001"]) {
      const res = await call("/", { headers: { authorization: sig(key) } });
      expect(res.status).toBe(403);
      expect(await res.text()).toContain("InvalidAccessKeyId");
    }
    expect(seen).toHaveLength(0);
  });

  it("answers JSON-protocol clients with a JSON error", async () => {
    const res = await call("/", { method: "POST", headers: { "content-type": "application/x-amz-json-1.0" }, body: "{}" });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ __type: "AccessDenied" });
  });

  it("hides emulator admin paths even for a valid key", async () => {
    for (const p of ["/_floci/reset", "//_floci/health", "/%5Ffloci/health", "/_localstack/health", "/q/health"]) {
      const res = await call(p, { headers: { authorization: sig(GOOD_KEY) } });
      expect(res.status, p).toBe(404);
    }
    expect(seen).toHaveLength(0);
  });

  it("forwards a signed request unchanged, keeping Host, path, query, headers and body", async () => {
    const res = await call("/bucket/key.txt?partNumber=2&uploadId=u1", {
      method: "PUT",
      headers: { authorization: sig(GOOD_KEY), "x-amz-content-sha256": "UNSIGNED-PAYLOAD", host: "api.example.com" },
      body: "hello world",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("echo:PUT:/bucket/key.txt?partNumber=2&uploadId=u1");
    expect(seen[0].body).toBe("hello world");
    expect(seen[0].headers.authorization).toBe(sig(GOOD_KEY));
    expect(seen[0].headers["x-amz-content-sha256"]).toBe("UNSIGNED-PAYLOAD");
    expect(seen[0].headers.host).toBe("api.example.com");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("accepts a presigned URL for an allowed key and rejects one for another key", async () => {
    const ok = await call(`/b/k?X-Amz-Credential=${GOOD_KEY}%2F20260101%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=s`);
    expect(ok.status).toBe(200);
    const bad = await call("/b/k?X-Amz-Credential=test%2F20260101%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=s");
    expect(bad.status).toBe(403);
  });

  it("passes CORS preflight through without credentials", async () => {
    const res = await call("/b/k", { method: "OPTIONS", headers: { origin: "https://app.example.com", "access-control-request-method": "PUT" } });
    expect(res.status).toBe(200);
    expect(seen[0].method).toBe("OPTIONS");
  });

  it("answers its own health probe without touching the emulator", async () => {
    const res = await call("/__gateway/health");
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(0);
  });

  describe("files host", () => {
    const files = { host: "files.example.com" };

    it("serves anonymous GET/HEAD for /<bucket>/<key> with credentials stripped", async () => {
      const res = await call("/pub/img/a.html", { headers: { ...files, authorization: sig(GOOD_KEY), cookie: "a=b", "x-amz-security-token": "t", range: "bytes=0-3" } });
      expect(res.status).toBe(200);
      expect(seen[0].headers.authorization).toBeUndefined();
      expect(seen[0].headers.cookie).toBeUndefined();
      expect(seen[0].headers["x-amz-security-token"]).toBeUndefined();
      expect(seen[0].headers.range).toBe("bytes=0-3");
      expect(seen[0].headers.host).not.toBe("files.example.com"); // rewritten to the upstream host
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["content-security-policy"]).toContain("sandbox");
    });

    it("refuses writes, bucket listings, admin paths and sub-resource reads", async () => {
      expect((await call("/pub/x", { method: "PUT", headers: files, body: "x" })).status).toBe(405);
      expect((await call("/pub/x", { method: "DELETE", headers: files })).status).toBe(405);
      expect((await call("/pub", { headers: files })).status).toBe(404);
      expect((await call("/", { headers: files })).status).toBe(404);
      expect((await call("/_floci/health", { headers: files })).status).toBe(404);
      expect(seen).toHaveLength(0);
      await call("/pub/x?acl&tagging", { headers: files });
      expect(seen[0].url).toBe("/pub/x");
    });
  });
});
