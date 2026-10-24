import { describe, it, expect, afterEach } from "vitest";
import {
  isLoopbackHost,
  resolveServerProbeHost,
  resolveServerProbeUrl,
} from "@/lib/aakash-network-server";

const originalEndpoint = process.env.AAKASH_ENDPOINT;

function setEndpoint(value: string | undefined) {
  if (value === undefined) {
    delete process.env.AAKASH_ENDPOINT;
  } else {
    process.env.AAKASH_ENDPOINT = value;
  }
}

describe("server-side connection probing", () => {
  afterEach(() => {
    setEndpoint(originalEndpoint);
  });

  it("detects loopback hostnames", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("127.0.1.5")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("aakash")).toBe(false);
    expect(isLoopbackHost("192.168.1.20")).toBe(false);
  });

  it("keeps the public host when both hosts are loopback (local development)", () => {
    setEndpoint("http://localhost:4566");
    expect(resolveServerProbeHost("localhost")).toBe("localhost");
    expect(resolveServerProbeHost("127.0.0.1")).toBe("127.0.0.1");
  });

  it("probes the backend host when the public host is loopback (container deployment)", () => {
    setEndpoint("http://aakash:4566");
    expect(resolveServerProbeHost("localhost")).toBe("aakash");
    expect(resolveServerProbeHost("127.0.0.1")).toBe("aakash");
  });

  it("keeps non-loopback public hosts, which the server can reach directly", () => {
    setEndpoint("http://aakash:4566");
    expect(resolveServerProbeHost("192.168.1.20")).toBe("192.168.1.20");
    expect(resolveServerProbeHost("100.64.0.10")).toBe("100.64.0.10");
  });

  it("falls back to the public host when the endpoint is missing or invalid", () => {
    setEndpoint(undefined);
    expect(resolveServerProbeHost("localhost")).toBe("localhost");

    setEndpoint("not a url");
    expect(resolveServerProbeHost("localhost")).toBe("localhost");
  });

  it("rewrites loopback probe URLs to the backend endpoint", () => {
    setEndpoint("http://aakash:4566");
    expect(resolveServerProbeUrl("http://localhost:4566")).toBe("http://aakash:4566");
    expect(resolveServerProbeUrl("http://127.0.0.1:4566")).toBe("http://aakash:4566");
    expect(resolveServerProbeUrl("http://192.168.1.20:4566")).toBe(
      "http://192.168.1.20:4566"
    );
  });

  it("keeps loopback probe URLs in local development", () => {
    setEndpoint("http://localhost:4566");
    expect(resolveServerProbeUrl("http://localhost:4566")).toBe("http://localhost:4566");
  });
});
