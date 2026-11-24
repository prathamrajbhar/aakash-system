import { networkConfigRepo } from "./network-config/repository";
import type { AakashNetworkConfig, NetworkDiagnostics } from "./network-config/types";
import {
  buildRdsConnectionDetails as buildRdsPure,
  buildEc2SshDetails as buildEc2Pure,
  buildElastiCacheDetails as buildElastiCachePure,
  getNetworkDiagnostics as getNetworkDiagnosticsPure,
} from "./aakash-network";

export * from "./aakash-network";

export function getServerNetworkConfig(): AakashNetworkConfig {
  return networkConfigRepo.get();
}

export function getServerNetworkDiagnostics(): NetworkDiagnostics {
  const config = getServerNetworkConfig();
  const isLocked = networkConfigRepo.isLocked();
  return getNetworkDiagnosticsPure(config, isLocked);
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
