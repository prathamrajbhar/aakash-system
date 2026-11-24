"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, Terminal, Box, Search, X } from "lucide-react";
import { useNetworkConfig } from "../providers/network-provider";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface HealthData {
  status: "UP" | "DOWN";
  version?: string;
  uptime?: number;
}

const SERVICES_SEARCH = [
  { name: "S3 - Object Storage", href: "/s3" },
  { name: "RDS - Relational Databases", href: "/rds" },
  { name: "EC2 - Virtual Compute", href: "/ec2" },
  { name: "ElastiCache - In-Memory Cache", href: "/elasticache" },
  { name: "Lambda - Serverless Functions", href: "/lambda" },
  { name: "SQS & SNS - Messaging", href: "/messaging" },
  { name: "SES - Simple Email Service", href: "/ses" },
  { name: "Network & Access Settings", href: "/settings/network" },
];

export function Header() {
  const router = useRouter();
  const { config } = useNetworkConfig();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { data: health } = useQuery<HealthData>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const isUp = health?.status === "UP";
  const filtered = searchQuery.trim()
    ? SERVICES_SEARCH.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <header className="h-12 bg-white border-b border-slate-200 text-slate-800 px-4 flex items-center justify-between shrink-0 select-none z-50 shadow-2xs">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-7 w-7 rounded-md bg-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-2xs group-hover:bg-amber-400 transition-colors">
            <Box className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold tracking-tight text-slate-900 text-sm">aakash</span>
            <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              Console
            </span>
          </div>
        </Link>
      </div>

      {/* Center Search Bar */}
      <div className="relative flex-1 max-w-lg mx-6 hidden md:block">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            placeholder="Search services, features, and docs [S3, RDS, EC2...]"
            className="w-full h-8 pl-8 pr-8 rounded-md bg-slate-50/80 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
          />
          {searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery("");
                setIsSearchOpen(false);
              }}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {/* Quick Search Dropdown */}
        {isSearchOpen && filtered.length > 0 ? (
          <div className="absolute top-10 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50">
            {filtered.map((item) => (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-between transition-colors"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-[10px] text-slate-400">Go &rarr;</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5 text-xs">
        {/* Terminal / CloudShell Action */}
        <Link
          href="/settings/network"
          title="Endpoint & Terminal Setup"
          className="h-7 px-2.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Terminal className="h-3.5 w-3.5 text-amber-600" />
          <span className="font-mono text-[11px] hidden sm:inline">{config.host}:{config.apiPort}</span>
        </Link>

        {/* Region */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700">
          <Globe className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium">us-east-1</span>
        </div>

        {/* Engine Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
            isUp
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          <span className="relative flex h-2 w-2">
            {isUp ? (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            ) : null}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isUp ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
          </span>
          <span className="font-semibold text-[11px] uppercase tracking-wider">
            {isUp ? "Healthy" : "Offline"}
          </span>
        </div>
      </div>
    </header>
  );
}
