import { describe, it, expect, afterEach } from "vitest";
import {
  buildAakashApiEndpoint,
  buildRdsConnectionDetails,
  buildEc2SshDetails,
  buildElastiCacheDetails,
  getAwsCliSnippet,
  getNetworkDiagnostics,
  isPortInRange,
  PORT_RANGES,
} from "@/lib/aakash-network";
import { getEnvNetworkConfig } from "@/lib/network-config/env";
import type { AakashNetworkConfig } from "@/lib/network-config/types";

const local: AakashNetworkConfig = { protocol: "http", host: "localhost", apiPort: 4566 };

describe("network helpers (lib/aakash-network.ts)", () => {
  it("builds the API endpoint and CLI snippet", () => {
    expect(buildAakashApiEndpoint(local)).toBe("http://localhost:4566");
    expect(getAwsCliSnippet(local)).toContain("export AWS_ENDPOINT_URL=http://localhost:4566");
  });

  it("rewrites internal docker addresses to the public host for RDS", () => {
    const rds = buildRdsConnectionDetails("10.0.4.2", 7001, "postgres", "postgres", "postgres", undefined, local, "pw");
    expect(rds.endpoint).toBe("localhost:7001");
    expect(rds.psqlUri).toBe("postgresql://postgres:pw@localhost:7001/postgres");
    expect(rds.psqlCliCommand).not.toContain("10.0.4.2");
  });

  it("builds SSH and redis commands and flags out-of-range ports", () => {
    expect(buildEc2SshDetails(2200, "root", undefined, undefined, local).sshCommand).toBe("ssh -p 2200 root@localhost");
    expect(buildEc2SshDetails(9999, "root", undefined, undefined, local).isPortValid).toBe(false);
    expect(buildElastiCacheDetails(6380, undefined, local).redisCliCommand).toBe("redis-cli -h localhost -p 6380 PING");
  });

  it("checks port ranges", () => {
    expect(isPortInRange(PORT_RANGES.RDS_START, PORT_RANGES.RDS_START, PORT_RANGES.RDS_END)).toBe(true);
    expect(isPortInRange(PORT_RANGES.RDS_END + 1, PORT_RANGES.RDS_START, PORT_RANGES.RDS_END)).toBe(false);
  });

  it("reports diagnostics", () => {
    const d = getNetworkDiagnostics(local);
    expect(d.apiEndpoint).toBe("http://localhost:4566");
    expect(d.portRanges.rds).toContain("7001");
  });
});

describe("getEnvNetworkConfig", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("defaults to http://localhost:4566", () => {
    expect(getEnvNetworkConfig({})).toEqual(local);
  });

  it("reads host, protocol and port from env and ignores bad ports", () => {
    expect(
      getEnvNetworkConfig({ AAKASH_PUBLIC_HOST: " myhost ", AAKASH_PUBLIC_PROTOCOL: "https", AAKASH_API_PORT: "9000" })
    ).toEqual({ protocol: "https", host: "myhost", apiPort: 9000 });
    expect(getEnvNetworkConfig({ AAKASH_API_PORT: "99999" }).apiPort).toBe(4566);
  });
});

describe("buildAakashApiEndpoint on a public domain", () => {
  it("omits the port when it is the default for the protocol", () => {
    expect(buildAakashApiEndpoint({ protocol: "https", host: "api.example.com", apiPort: 443 })).toBe("https://api.example.com");
    expect(buildAakashApiEndpoint({ protocol: "http", host: "api.example.com", apiPort: 80 })).toBe("http://api.example.com");
  });

  it("keeps non-default ports", () => {
    expect(buildAakashApiEndpoint({ protocol: "https", host: "h", apiPort: 8443 })).toBe("https://h:8443");
    expect(buildAakashApiEndpoint({ protocol: "http", host: "localhost", apiPort: 4566 })).toBe("http://localhost:4566");
  });
});
