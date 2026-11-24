"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNetworkConfig } from "@/components/providers/network-provider";
import { AwsWelcomeBanner } from "@/components/dashboard/aws-welcome-banner";
import { AwsServiceCards } from "@/components/dashboard/aws-service-cards";
import { AwsHealthWidget } from "@/components/dashboard/aws-health-widget";
import { AwsCliWidget } from "@/components/dashboard/aws-cli-widget";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch, apiSend } from "@/lib/api/client";

interface HealthApiResponse {
  status: "UP" | "DOWN";
  version: string;
  uptime?: number;
  diagnostics?: {
    status: string;
    publicHost: string;
    publicProtocol: string;
    publicServiceEndpoint: string;
    servicePort: number;
    portRanges: {
      rds: string;
      ec2Ssh: string;
      elastiCache: string;
    };
  };
}

/** Fetches a list endpoint and returns the length of `field`, or 0 until loaded / on error. */
function useResourceCount(queryKey: string, url: string, field: string): number {
  const { data } = useQuery<Record<string, unknown>>({
    queryKey: [queryKey],
    queryFn: () => apiFetch<Record<string, unknown>>(url),
  });
  const items = data?.[field];
  return Array.isArray(items) ? items.length : 0;
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { apiEndpoint } = useNetworkConfig();
  const [feedback, setFeedback] = useState<string | null>(null);

  // Health query
  const { data: health, error: healthError } = useQuery<HealthApiResponse>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error("Could not reach Aakash health endpoint");
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Resource summaries (query keys are shared with each service page so a
  // mutation there refreshes the home counters too).
  const s3Count = useResourceCount("s3-buckets", "/api/s3", "buckets");
  const rdsCount = useResourceCount("rds-instances", "/api/rds", "instances");
  const ec2Count = useResourceCount("ec2-instances", "/api/ec2", "instances");
  const elastiCacheCount = useResourceCount("elasticache-clusters", "/api/elasticache", "clusters");
  const sesCount = useResourceCount("ses-identities", "/api/ses", "identities");
  const dynamoCount = useResourceCount("dynamodb-tables", "/api/dynamodb", "tables");

  // State reset mutation
  const resetMutation = useMutation({
    mutationFn: () => apiSend("/api/health", "POST"),
    onSuccess: () => {
      setFeedback("Aakash emulator state has been purged successfully.");
      queryClient.invalidateQueries();
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (err: Error) => {
      setFeedback(`Reset failed: ${err.message}`);
    },
  });

  const isUp = health?.status === "UP";
  const counts = {
    s3: s3Count,
    rds: rdsCount,
    ec2: ec2Count,
    elasticache: elastiCacheCount,
    ses: sesCount,
    dynamodb: dynamoCount,
  };

  return (
    <div className="space-y-6">
      {/* Top AWS Welcome Banner */}
      <AwsWelcomeBanner
        apiEndpoint={apiEndpoint}
        isUp={isUp}
        version={health?.version || "1.0.0"}
      />

      {feedback ? (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium shadow-2xs">
          {feedback}
        </div>
      ) : null}

      {healthError ? (
        <ErrorBanner
          error={healthError}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["health"] })}
        />
      ) : null}

      {/* Core AWS Services Grid */}
      <AwsServiceCards counts={counts} />

      {/* Bottom Grid: System Diagnostics & CLI Connect */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AwsCliWidget apiEndpoint={apiEndpoint} />
        <AwsHealthWidget
          version={health?.version || "1.0.0"}
          publicEndpoint={apiEndpoint}
          portRanges={health?.diagnostics?.portRanges}
          onReset={async () => {
            await resetMutation.mutateAsync();
          }}
          isResetting={resetMutation.isPending}
        />
      </div>
    </div>
  );
}
