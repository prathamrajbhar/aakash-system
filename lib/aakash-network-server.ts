import { getEnvNetworkConfig } from "./network-config/env";
import type { AakashNetworkConfig, NetworkDiagnostics } from "./network-config/types";
import {
  buildRdsConnectionDetails as buildRdsPure,
  buildEc2SshDetails as buildEc2Pure,
  buildElastiCacheDetails as buildElastiCachePure,
  getNetworkDiagnostics as getNetworkDiagnosticsPure,
} from "./aakash-network";

export * from "./aakash-network";

export function getServerNetworkConfig(): AakashNetworkConfig {
  return getEnvNetworkConfig();
}

export function getServerNetworkDiagnostics(): NetworkDiagnostics {
  return getNetworkDiagnosticsPure(getServerNetworkConfig());
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "::"]);

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return (
    LOOPBACK_HOSTNAMES.has(normalized) ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

function getEndpointUrl(): URL | null {
  const endpoint = process.env.AAKASH_ENDPOINT;
  if (!endpoint) return null;

  try {
    return new URL(endpoint);
  } catch {
    return null;
  }
}

function getEndpointHostname(): string | null {
  const endpointUrl = getEndpointUrl();
  if (!endpointUrl) return null;
  return endpointUrl.hostname.replace(/^\[|\]$/g, "") || null;
}

/**
 * Whether the connection tester may open a socket to `host`. The tester runs
 * server-side, so accepting any caller-supplied host would let it be used as a
 * port scanner against the internal network. Only loopback, the configured
 * public host and the emulator's own host are valid targets.
 */
export function isAllowedProbeHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!normalized) return false;
  if (isLoopbackHost(normalized)) return true;

  const allowed = new Set<string>([getServerNetworkConfig().host.toLowerCase()]);
  const endpointHost = getEndpointHostname();
  if (endpointHost) allowed.add(endpointHost.toLowerCase());
  return allowed.has(normalized);
}

/**
 * Resolves the host the Next.js server itself should connect to when probing a
 * proxied resource (RDS, ElastiCache, SSH).
 *
 * The host shown to users comes from the public network config (for example
 * `localhost`). When the dashboard runs inside a container, `localhost` is the
 * dashboard container, not the backend container that publishes ports
 * 7001-7099. `AAKASH_ENDPOINT` already describes how the server reaches the
 * backend, so reuse its hostname whenever the public host is a loopback
 * address. When both are loopback (local development) the public host is kept.
 */
export function resolveServerProbeHost(publicHost: string): string {
  const endpointHost = getEndpointHostname();
  if (!endpointHost || !isLoopbackHost(publicHost) || isLoopbackHost(endpointHost)) {
    return publicHost;
  }
  return endpointHost;
}

/**
 * Same as {@link resolveServerProbeHost}, but for full URLs. Used by the
 * settings connection test when the server has to reach the Aakash API.
 */
export function resolveServerProbeUrl(publicUrl: string): string {
  const endpointUrl = getEndpointUrl();
  if (!endpointUrl) return publicUrl;

  try {
    const publicUrlObj = new URL(publicUrl);
    if (!isLoopbackHost(publicUrlObj.hostname)) return publicUrl;
    if (isLoopbackHost(endpointUrl.hostname)) return publicUrl;
    return endpointUrl.toString().replace(/\/+$/, "");
  } catch {
    return publicUrl;
  }
}

export function buildServerRdsDetails(
  rawAddress?: string,
  rawPort?: number,
  engine: string = "postgres",
  username: string = "postgres",
  dbName: string = "postgres",
  resourceId?: string,
  password?: string
) {
  return buildRdsPure(rawAddress, rawPort, engine, username, dbName, resourceId, getServerNetworkConfig(), password);
}

export function buildServerEc2Details(
  rawPort: number,
  user: string = "root",
  rawPrivateIp?: string,
  resourceId?: string
) {
  return buildEc2Pure(rawPort, user, rawPrivateIp, resourceId, getServerNetworkConfig());
}

export function buildServerElastiCacheDetails(rawPort: number, resourceId?: string) {
  return buildElastiCachePure(rawPort, resourceId, getServerNetworkConfig());
}
