"use client";

import React, { useState } from "react";
import { Terminal } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";

export function AwsCliWidget({ apiEndpoint }: { apiEndpoint: string }) {
  const [activeTab, setActiveTab] = useState<"env" | "s3" | "rds">("env");

  const envSnippet = `export AWS_ENDPOINT_URL="${apiEndpoint}"
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"
export AWS_DEFAULT_REGION="us-east-1"`;

  const s3Snippet = `aws s3 ls --endpoint-url ${apiEndpoint}
aws s3 mb s3://my-test-bucket --endpoint-url ${apiEndpoint}
aws s3 cp file.txt s3://my-test-bucket/ --endpoint-url ${apiEndpoint}`;

  const rdsSnippet = `aws rds describe-db-instances --endpoint-url ${apiEndpoint}
psql -h localhost -p 7001 -U postgres -d postgres`;

  const snippets = {
    env: envSnippet,
    s3: s3Snippet,
    rds: rdsSnippet,
  };

  return (
    <div className="rounded-xl bg-white border border-slate-200/90 overflow-hidden shadow-2xs">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-slate-700" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            AWS CLI & Terminal Quick Connect
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab("env")}
            className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
              activeTab === "env" ? "bg-white text-slate-900 font-medium shadow-2xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Environment
          </button>
          <button
            onClick={() => setActiveTab("s3")}
            className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
              activeTab === "s3" ? "bg-white text-slate-900 font-medium shadow-2xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            S3 CLI
          </button>
          <button
            onClick={() => setActiveTab("rds")}
            className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
              activeTab === "rds" ? "bg-white text-slate-900 font-medium shadow-2xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            RDS CLI
          </button>
        </div>
      </div>

      <div className="p-3">
        <div className="p-4 rounded-lg bg-slate-950 font-mono text-xs text-slate-200 relative group border border-slate-800">
          <pre className="overflow-x-auto leading-relaxed selection:bg-amber-500/30 selection:text-amber-200">
            {snippets[activeTab]}
          </pre>
          <div className="absolute top-3 right-3 opacity-80 group-hover:opacity-100 transition-opacity">
            <CopyButton text={snippets[activeTab]} />
          </div>
        </div>
      </div>
    </div>
  );
}
