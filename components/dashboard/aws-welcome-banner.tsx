"use client";

import React from "react";
import { Server, HardDrive, ExternalLink } from "lucide-react";
import Link from "next/link";

interface WelcomeBannerProps {
  apiEndpoint: string;
  isUp: boolean;
  version: string;
  networkMode: string;
}

export function AwsWelcomeBanner({
  apiEndpoint,
  isUp,
  version,
  networkMode,
}: WelcomeBannerProps) {
  return (
    <div className="rounded-xl bg-white border border-slate-200/90 p-6 shadow-2xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              AWS Local Cloud Console
            </h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              v{version}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Connected to Aakash emulator at <code className="text-slate-900 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">{apiEndpoint}</code>
          </p>
        </div>

        {/* Quick telemetry chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
            isUp
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}>
            <span className={`h-2 w-2 rounded-full ${isUp ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <span>{isUp ? "Engine Healthy" : "Engine Down"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium">
            <Server className="h-3.5 w-3.5 text-slate-500" />
            <span className="capitalize">Mode: {networkMode}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium">
            <HardDrive className="h-3.5 w-3.5 text-emerald-600" />
            <span>Host Persistent</span>
          </div>

          <Link
            href="/settings/network"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors shadow-2xs"
          >
            <span>Network</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
