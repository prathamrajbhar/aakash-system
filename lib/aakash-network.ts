import type { AakashNetworkConfig, NetworkDiagnostics } from "./network-config/types";
import { logger } from "./logger";

export interface RdsConnectionDetails {
  endpoint: string;
  host: string;
  port: number;
  isPortValid: boolean;
  psqlUri: string;
  psqlCliCommand: string;
  pgPasswordCommand: string;
  mysqlCliCommand: string;
}

export interface Ec2SshDetails {
  host: string;
  port: number;
  isPortValid: boolean;
  sshCommand: string;
  internalContainerAddress?: string;
}

export interface ElastiCacheConnectionDetails {
  host: string;
  port: number;
  isPortValid: boolean;
  redisCliCommand: string;
}

function readPort(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : fallback;
}

function readRange(startName: string, endName: string, defStart: number, defEnd: number) {
  const start = readPort(startName, defStart);
  const end = readPort(endName, defEnd);
  // An inverted range is a misconfiguration: fall back to the defaults.
  return start <= end ? { start, end } : { start: defStart, end: defEnd };
}

const rdsRange = readRange("AAKASH_RDS_PORT_RANGE_START", "AAKASH_RDS_PORT_RANGE_END", 7001, 7099);
const ec2Range = readRange("AAKASH_EC2_SSH_PORT_RANGE_START", "AAKASH_EC2_SSH_PORT_RANGE_END", 2200, 2299);
const cacheRange = readRange(
  "AAKASH_ELASTICACHE_PORT_RANGE_START",
  "AAKASH_ELASTICACHE_PORT_RANGE_END",
  6379,
  6399
);

// Port ranges the console treats as "reachable". Defaults match docker-compose.yml;
// override them with the AAKASH_*_PORT_RANGE_* environment variables (server side).
export const PORT_RANGES = {
  RDS_START: rdsRange.start,
  RDS_END: rdsRange.end,
  EC2_SSH_START: ec2Range.start,
  EC2_SSH_END: ec2Range.end,
  ELASTICACHE_START: cacheRange.start,
  ELASTICACHE_END: cacheRange.end,
};

export const DEFAULT_NETWORK_CONFIG: AakashNetworkConfig = {
  protocol: "http",
  host: "localhost",
  apiPort: 4566,
};

/**
 * Resolves active network config.
 */
export function getActiveNetworkConfig(overrideConfig?: Partial<AakashNetworkConfig>): AakashNetworkConfig {
  if (overrideConfig && overrideConfig.host) {
    return {
      protocol: overrideConfig.protocol || "http",
      host: overrideConfig.host,
      apiPort: overrideConfig.apiPort || 4566,
    };
  }
  return DEFAULT_NETWORK_CONFIG;
}

/**
 * Returns the public user-facing Aakash AWS API endpoint (e.g. http://localhost:4566, http://192.168.1.20:4566, http://100.64.0.10:4566).
 */
export function buildAakashApiEndpoint(config?: AakashNetworkConfig): string {
  const active = getActiveNetworkConfig(config);
  // Behind a reverse proxy or tunnel the API is on the standard port, which URLs leave out.
  const isDefaultPort =
    (active.protocol === "https" && active.apiPort === 443) ||
    (active.protocol === "http" && active.apiPort === 80);
  return isDefaultPort
    ? `${active.protocol}://${active.host}`
    : `${active.protocol}://${active.host}:${active.apiPort}`;
}

/**
 * Returns the public user-facing S3 service endpoint.
 */
export function buildS3Endpoint(config?: AakashNetworkConfig): string {
  return buildAakashApiEndpoint(config);
}

/**
 * Validates whether a port falls within the configured start and end bounds.
 */
export function isPortInRange(port: number, start: number, end: number): boolean {
  return Number.isInteger(port) && port >= start && port <= end;
}

/**
 * Rewrites internal Docker/container addresses returned by Aakash to the user's configured access host,
 * and generates clean copyable connection commands for PostgreSQL and MySQL.
 */
export function buildRdsConnectionDetails(
  rawAddress: string | undefined,
  rawPort: number | undefined,
  engine: string = "postgres",
  username: string = "postgres",
  dbName: string = "postgres",
  resourceId?: string,
  config?: AakashNetworkConfig,
  password?: string
): RdsConnectionDetails {
  const active = getActiveNetworkConfig(config);
  const host = active.host;
  const port = rawPort || 7001;
  const isPortValid = isPortInRange(port, PORT_RANGES.RDS_START, PORT_RANGES.RDS_END);

  if (rawAddress && (rawAddress.startsWith("10.") || rawAddress.startsWith("172.") || rawAddress.includes("aakash"))) {
    logger.warn(
      { resourceId, rawAddress, sanitizedHost: host },
      "Aakash returned an internal Docker network address for RDS. Rewriting to configured public access host."
    );
  }

  const endpoint = `${host}:${port}`;
  const effectiveDbName = dbName || (engine === "postgres" ? "postgres" : "");
  const effectivePassword = password || "postgres";

  const psqlUri = `postgresql://${username}:${effectivePassword}@${host}:${port}/${effectiveDbName || "postgres"}`;
  const psqlCliCommand = `psql "host=${host} port=${port} dbname=${effectiveDbName || "postgres"} user=${username} sslmode=disable"`;
  const pgPasswordCommand = `PGPASSWORD='${effectivePassword}' psql -h ${host} -p ${port} -U ${username} -d ${effectiveDbName || "postgres"}`;
  const mysqlCliCommand = `mysql -h ${host} -P ${port} -u ${username} -p'${effectivePassword}'`;

  return {
    endpoint,
    host,
    port,
    isPortValid,
    psqlUri,
    psqlCliCommand,
    pgPasswordCommand,
    mysqlCliCommand,
  };
}

/**
 * Generates copyable EC2 SSH command based on the active network configuration.
 */
export function buildEc2SshDetails(
  rawPort: number,
  user: string = "root",
  rawPrivateIp?: string,
  resourceId?: string,
  config?: AakashNetworkConfig
): Ec2SshDetails {
  const active = getActiveNetworkConfig(config);
  const host = active.host;
  const isPortValid = isPortInRange(
    rawPort,
    PORT_RANGES.EC2_SSH_START,
    PORT_RANGES.EC2_SSH_END
  );

  if (!isPortValid) {
    logger.warn(
      { resourceId, rawPort },
      "EC2 SSH port outside of configured range. Marking endpoint unavailable."
    );
  }

  const sshCommand = isPortValid
    ? `ssh -p ${rawPort} ${user}@${host}`
    : "SSH endpoint unavailable (port out of range)";

  return {
    host,
    port: rawPort,
    isPortValid,
    sshCommand,
    internalContainerAddress: rawPrivateIp,
  };
}

/**
 * Generates copyable ElastiCache Redis CLI commands based on the active network configuration.
 */
export function buildElastiCacheDetails(
  rawPort: number,
  resourceId?: string,
  config?: AakashNetworkConfig
): ElastiCacheConnectionDetails {
  const active = getActiveNetworkConfig(config);
  const host = active.host;
  const isPortValid = isPortInRange(
    rawPort,
    PORT_RANGES.ELASTICACHE_START,
    PORT_RANGES.ELASTICACHE_END
  );

  if (!isPortValid) {
    logger.warn(
      { resourceId, rawPort },
      "ElastiCache port outside of configured range. Using safe fallback."
    );
  }

  return {
    host,
    port: rawPort,
    isPortValid,
    redisCliCommand: `redis-cli -h ${host} -p ${rawPort} PING`,
  };
}

/**
 * Generates copyable AWS CLI configuration environment variables for user terminal setup.
 */
export function getAwsCliSnippet(
  config?: AakashNetworkConfig,
  region: string = "us-east-1",
  accessKey: string = "test",
  secretKey: string = "test"
): string {
  const endpointUrl = buildAakashApiEndpoint(config);
  return `export AWS_ENDPOINT_URL=${endpointUrl}\nexport AWS_DEFAULT_REGION=${region}\nexport AWS_ACCESS_KEY_ID=${accessKey}\nexport AWS_SECRET_ACCESS_KEY=${secretKey}`;
}

/**
 * Returns structured network diagnostics metadata.
 */
export function getNetworkDiagnostics(config?: AakashNetworkConfig): NetworkDiagnostics {
  const active = getActiveNetworkConfig(config);

  return {
    apiEndpoint: buildAakashApiEndpoint(active),
    host: active.host,
    protocol: active.protocol,
    apiPort: active.apiPort,
    portRanges: {
      rds: `${PORT_RANGES.RDS_START}–${PORT_RANGES.RDS_END}`,
      ec2Ssh: `${PORT_RANGES.EC2_SSH_START}–${PORT_RANGES.EC2_SSH_END}`,
      elastiCache: `${PORT_RANGES.ELASTICACHE_START}–${PORT_RANGES.ELASTICACHE_END}`,
    },
  };
}

/**
 * Backward compatibility alias for existing code referencing getPublicServiceEndpoint / getTailscaleAwsCliSnippet.
 */
export const getPublicServiceEndpoint = buildAakashApiEndpoint;
export const getTailscaleAwsCliSnippet = getAwsCliSnippet;
