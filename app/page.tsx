"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNetworkConfig } from "@/components/providers/network-provider";
import { AwsWelcomeBanner } from "@/components/dashboard/aws-welcome-banner";
import { AwsServiceCards } from "@/components/dashboard/aws-service-cards";
import { AwsHealthWidget } from "@/components/dashboard/aws-health-widget";
import { AwsCliWidget } from "@/components/dashboard/aws-cli-widget";
import { ErrorBanner } from "@/components/ui/error-banner";

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

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { config: networkConfig, apiEndpoint } = useNetworkConfig();
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

  // Resource summaries
  const { data: s3Data } = useQuery({
    queryKey: ["s3-buckets"],
    queryFn: async () => (await fetch("/api/s3")).json(),
  });

  const { data: rdsData } = useQuery({
    queryKey: ["rds-instances"],
    queryFn: async () => (await fetch("/api/rds")).json(),
  });

  const { data: ec2Data } = useQuery({
    queryKey: ["ec2-instances"],
    queryFn: async () => (await fetch("/api/ec2")).json(),
  });

  const { data: elastiCacheData } = useQuery({
    queryKey: ["elasticache-clusters"],
    queryFn: async () => (await fetch("/api/elasticache")).json(),
  });

  const { data: lambdaData } = useQuery({
    queryKey: ["lambda-functions"],
    queryFn: async () => (await fetch("/api/lambda")).json(),
  });

  const { data: sqsData } = useQuery({
    queryKey: ["sqs-queues"],
    queryFn: async () => (await fetch("/api/sqs")).json(),
  });

  const { data: sesData } = useQuery({
    queryKey: ["ses-identities"],
    queryFn: async () => (await fetch("/api/ses")).json(),
  });

  const { data: dynamoData } = useQuery({
    queryKey: ["dynamodb-tables"],
    queryFn: async () => (await fetch("/api/dynamodb")).json(),
  });

  const { data: ssmData } = useQuery({
    queryKey: ["ssm-parameters"],
    queryFn: async () => (await fetch("/api/ssm")).json(),
  });

  const { data: cwData } = useQuery({
    queryKey: ["cw-log-groups"],
    queryFn: async () => (await fetch("/api/cloudwatch-logs")).json(),
  });

  // State reset mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/health", { method: "POST" });
      if (!res.ok) throw new Error("State reset failed");
      return res.json();
    },
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
    s3: s3Data?.buckets?.length || 0,
    rds: rdsData?.instances?.length || 0,
    ec2: ec2Data?.instances?.length || 0,
    elasticache: elastiCacheData?.clusters?.length || 0,
    lambda: lambdaData?.functions?.length || 0,
    sqs: sqsData?.queues?.length || 0,
    ses: sesData?.identities?.length || 0,
    dynamodb: dynamoData?.tables?.length || 0,
    ssm: ssmData?.parameters?.length || 0,
    cloudwatch: cwData?.logGroups?.length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Top AWS Welcome Banner */}
      <AwsWelcomeBanner
        apiEndpoint={apiEndpoint}
        isUp={isUp}
        version={health?.version || "1.0.0"}
        networkMode={networkConfig.mode}
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
