"use client";

import React from "react";
import Link from "next/link";
import {
  HardDrive,
  Database,
  Server,
  Zap,
  Mail,
} from "lucide-react";

interface ServiceCounts {
  s3: number;
  rds: number;
  ec2: number;
  elasticache: number;
  ses: number;
  dynamodb?: number;
}

export function AwsServiceCards({ counts }: { counts: ServiceCounts }) {
  const services = [
    {
      name: "Amazon S3",
      tag: "S3",
      category: "Storage",
      description: "Scalable object storage for files, backups, and web assets.",
      href: "/s3",
      icon: HardDrive,
      color: "text-emerald-700 bg-emerald-50 border-emerald-200/80",
      countLabel: `${counts.s3} Bucket${counts.s3 === 1 ? "" : "s"}`,
    },
    {
      name: "Amazon DynamoDB",
      tag: "DynamoDB",
      category: "NoSQL",
      description: "Fast, flexible NoSQL database with key schemas and item scanner.",
      href: "/dynamodb",
      icon: Database,
      color: "text-teal-700 bg-teal-50 border-teal-200/80",
      countLabel: `${counts.dynamodb ?? 0} Table${(counts.dynamodb ?? 0) === 1 ? "" : "s"}`,
    },
    {
      name: "Amazon RDS",
      tag: "RDS",
      category: "Databases",
      description: "Managed PostgreSQL, MySQL, and MariaDB relational engines.",
      href: "/rds",
      icon: Database,
      color: "text-blue-700 bg-blue-50 border-blue-200/80",
      countLabel: `${counts.rds} Instance${counts.rds === 1 ? "" : "s"}`,
    },
    {
      name: "Amazon EC2",
      tag: "EC2",
      category: "Compute",
      description: "Virtual server instances with mapped SSH access.",
      href: "/ec2",
      icon: Server,
      color: "text-amber-700 bg-amber-50 border-amber-200/80",
      countLabel: `${counts.ec2} Server${counts.ec2 === 1 ? "" : "s"}`,
    },
    {
      name: "Amazon ElastiCache",
      tag: "ElastiCache",
      category: "In-Memory",
      description: "High-throughput Redis and Valkey in-memory data clusters.",
      href: "/elasticache",
      icon: Zap,
      color: "text-rose-700 bg-rose-50 border-rose-200/80",
      countLabel: `${counts.elasticache} Cluster${counts.elasticache === 1 ? "" : "s"}`,
    },
    {
      name: "Amazon SES",
      tag: "SES",
      category: "Email",
      description: "Verified email identities and local captured-mail testing inbox.",
      href: "/ses",
      icon: Mail,
      color: "text-cyan-700 bg-cyan-50 border-cyan-200/80",
      countLabel: `${counts.ses} Identit${counts.ses === 1 ? "y" : "ies"}`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Core AWS Services
        </h2>
        <span className="text-xs text-slate-400">6 Services Active</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <Link
              key={service.tag}
              href={service.href}
              className="group flex flex-col justify-between rounded-xl bg-white border border-slate-200/90 p-5 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${service.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                    {service.countLabel}
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-slate-900 group-hover:text-slate-900 transition-colors">
                  {service.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {service.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-100 text-xs font-medium text-slate-400">
                <span className="text-[11px] uppercase tracking-wider text-slate-400">
                  {service.category}
                </span>
                <span className="flex items-center gap-1 text-slate-900 font-medium group-hover:translate-x-0.5 transition-transform">
                  Open &rarr;
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
