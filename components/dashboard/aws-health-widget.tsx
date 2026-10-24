"use client";

import React, { useState } from "react";
import { Activity, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface HealthWidgetProps {
  version: string;
  publicEndpoint: string;
  portRanges?: {
    rds: string;
    ec2Ssh: string;
    elastiCache: string;
  };
  onReset: () => Promise<void>;
  isResetting: boolean;
}

export function AwsHealthWidget({
  version,
  publicEndpoint,
  portRanges,
  onReset,
  isResetting,
}: HealthWidgetProps) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  return (
    <div className="rounded-xl bg-white border border-slate-200/90 p-5 space-y-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-700" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            System Diagnostics
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-mono text-[11px]">{publicEndpoint}</span>
          <span className="flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
            <CheckCircle2 className="h-3 w-3" />
            <span>v{version}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-slate-500 text-[11px] block font-medium">RDS Proxy Ports</span>
          <span className="font-mono font-medium text-slate-800 mt-0.5 block">
            {portRanges?.rds || "7001–7099"}
          </span>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-slate-500 text-[11px] block font-medium">EC2 SSH Ports</span>
          <span className="font-mono font-medium text-slate-800 mt-0.5 block">
            {portRanges?.ec2Ssh || "2200–2299"}
          </span>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-slate-500 text-[11px] block font-medium">Redis Cache Ports</span>
          <span className="font-mono font-medium text-slate-800 mt-0.5 block">
            {portRanges?.elastiCache || "6379–6399"}
          </span>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-slate-500 text-[11px] block font-medium">Host Data Mount</span>
          <span className="font-mono font-medium text-emerald-700 mt-0.5 block truncate" title="./aakash-data">
            ./aakash-data
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          <span>Maintenance Actions:</span>
        </div>

        <Button
          variant="destructive"
          size="sm"
          onClick={() => setResetDialogOpen(true)}
          isLoading={isResetting}
          className="text-xs cursor-pointer shadow-2xs"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Reset Emulator State
        </Button>
      </div>

      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="Reset All Aakash Data?"
        description="This will purge all temporary emulated S3 buckets, RDS databases, queues, and functions inside the running instance. Persistent host data files remain intact."
        confirmLabel="Reset State Now"
        variant="destructive"
        onConfirm={async () => {
          setResetDialogOpen(false);
          await onReset();
        }}
      />
    </div>
  );
}
