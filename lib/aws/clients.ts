import { S3Client } from "@aws-sdk/client-s3";
import { RDSClient } from "@aws-sdk/client-rds";
import { EC2Client } from "@aws-sdk/client-ec2";
import { ElastiCacheClient } from "@aws-sdk/client-elasticache";
import { SESClient } from "@aws-sdk/client-ses";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { awsConfig } from "./config";

function getBaseClientConfig() {
  const isAakashEndpoint = Boolean(awsConfig.AAKASH_ENDPOINT);

  return {
    region: awsConfig.AWS_REGION,
    credentials: {
      accessKeyId: awsConfig.AWS_ACCESS_KEY_ID,
      secretAccessKey: awsConfig.AWS_SECRET_ACCESS_KEY,
    },
    ...(isAakashEndpoint ? { endpoint: awsConfig.AAKASH_ENDPOINT } : {}),
    // Fail fast when the emulator is down instead of retrying for many seconds.
    maxAttempts: 3,
  };
}

/**
 * AWS SDK clients are cheap to share and expensive to recreate (each owns an
 * HTTP connection pool). Cache one instance per service on `globalThis` so
 * they also survive Next.js dev-server module reloads without leaking sockets.
 */
type ClientCache = Map<string, unknown>;
const globalCache = globalThis as typeof globalThis & { __aakashAwsClients?: ClientCache };

/**
 * Returns the cached client for `key`, rebuilding it when the cached instance
 * was created by a different copy of the SDK class (happens after a Next.js
 * hot reload, and breaks the SDK paginators' `instanceof` checks).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClientCtor<T> = abstract new (...args: any[]) => T;

function cached<T extends object>(key: string, Ctor: ClientCtor<T>, create: () => T): T {
  const store = (globalCache.__aakashAwsClients ??= new Map());
  const existing = store.get(key);
  if (existing instanceof Ctor) return existing;
  const client = create();
  store.set(key, client);
  return client;
}

export function getS3Client(): S3Client {
  return cached(
    "s3",
    S3Client,
    () =>
      new S3Client({
        ...getBaseClientConfig(),
        forcePathStyle: true, // Required for local S3 emulation
      })
  );
}

export function getRDSClient(): RDSClient {
  return cached("rds", RDSClient, () => new RDSClient(getBaseClientConfig()));
}

export function getEC2Client(): EC2Client {
  return cached("ec2", EC2Client, () => new EC2Client(getBaseClientConfig()));
}

export function getElastiCacheClient(): ElastiCacheClient {
  return cached("elasticache", ElastiCacheClient, () => new ElastiCacheClient(getBaseClientConfig()));
}

export function getSESClient(): SESClient {
  return cached("ses", SESClient, () => new SESClient(getBaseClientConfig()));
}

export function getDynamoDBClient(): DynamoDBClient {
  return cached("dynamodb", DynamoDBClient, () => new DynamoDBClient(getBaseClientConfig()));
}
