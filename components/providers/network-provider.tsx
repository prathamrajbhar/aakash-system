"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { AakashNetworkConfig, NetworkDiagnostics } from "@/lib/network-config/types";
import {
  buildAakashApiEndpoint,
  buildRdsConnectionDetails,
  buildEc2SshDetails,
  buildElastiCacheDetails,
  getAwsCliSnippet,
  RdsConnectionDetails,
  Ec2SshDetails,
  ElastiCacheConnectionDetails,
} from "@/lib/aakash-network";

interface NetworkContextValue {
  config: AakashNetworkConfig;
  diagnostics?: NetworkDiagnostics;
  apiEndpoint: string;
  buildRds: (
    rawAddress?: string,
    rawPort?: number,
    engine?: string,
    username?: string,
    dbName?: string,
    resourceId?: string
  ) => RdsConnectionDetails;
  buildEc2: (
    rawPort: number,
    user?: string,
    rawPrivateIp?: string,
    resourceId?: string
  ) => Ec2SshDetails;
  buildElastiCache: (
    rawPort: number,
    resourceId?: string
  ) => ElastiCacheConnectionDetails;
  awsCliSnippet: string;
}

const DEFAULT_CONFIG: AakashNetworkConfig = {
  protocol: "http",
  host: "localhost",
  apiPort: 4566,
};

const NetworkContext = createContext<NetworkContextValue>({
  config: DEFAULT_CONFIG,
  apiEndpoint: "http://localhost:4566",
  buildRds: () => buildRdsConnectionDetails(undefined, 7001, "postgres", "postgres", "postgres", undefined, DEFAULT_CONFIG),
  buildEc2: (port: number) => buildEc2SshDetails(port, "root", undefined, undefined, DEFAULT_CONFIG),
  buildElastiCache: (port: number) => buildElastiCacheDetails(port, undefined, DEFAULT_CONFIG),
  awsCliSnippet: getAwsCliSnippet(DEFAULT_CONFIG),
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  // The public host/port come from server env and are exposed via /api/health.
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<{ diagnostics?: NetworkDiagnostics }>("/api/health"),
    refetchInterval: 5000,
  });

  const diagnostics = data?.diagnostics;
  const activeConfig = useMemo<AakashNetworkConfig>(
    () =>
      diagnostics
        ? { protocol: diagnostics.protocol, host: diagnostics.host, apiPort: diagnostics.apiPort }
        : DEFAULT_CONFIG,
    [diagnostics]
  );

  const value = useMemo<NetworkContextValue>(
    () => ({
      config: activeConfig,
      diagnostics,
      apiEndpoint: buildAakashApiEndpoint(activeConfig),
      buildRds: (rawAddress, rawPort, engine, username, dbName, resourceId) =>
        buildRdsConnectionDetails(rawAddress, rawPort, engine, username, dbName, resourceId, activeConfig),
      buildEc2: (rawPort, user, rawPrivateIp, resourceId) =>
        buildEc2SshDetails(rawPort, user, rawPrivateIp, resourceId, activeConfig),
      buildElastiCache: (rawPort, resourceId) =>
        buildElastiCacheDetails(rawPort, resourceId, activeConfig),
      awsCliSnippet: getAwsCliSnippet(activeConfig),
    }),
    [activeConfig, diagnostics]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkConfig(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetworkConfig must be used within a NetworkProvider");
  }
  return context;
}
