"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  HardDrive,
  Server,
  Zap,
  Mail,
  FolderGit2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Console",
    items: [{ href: "/", label: "Console Home", icon: LayoutDashboard }],
  },
  {
    title: "Storage & Databases",
    items: [
      { href: "/s3", label: "S3", subtitle: "Object Storage", icon: HardDrive },
      { href: "/dynamodb", label: "DynamoDB", subtitle: "NoSQL Tables", icon: Database },
      { href: "/rds", label: "RDS", subtitle: "Databases", icon: Database },
      { href: "/elasticache", label: "ElastiCache", subtitle: "In-Memory", icon: Zap },
    ],
  },
  {
    title: "Compute",
    items: [
      { href: "/ec2", label: "EC2", subtitle: "Virtual Servers", icon: Server },
    ],
  },
  {
    title: "Email",
    items: [
      { href: "/ses", label: "SES", subtitle: "Email Inbox", icon: Mail },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0 h-full select-none">
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <span className="px-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {group.title}
            </span>
            <div className="space-y-0.5 mt-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-all",
                      isActive
                        ? "bg-slate-100 text-slate-900 font-semibold border-l-2 border-slate-900 pl-2 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-amber-600" : "text-slate-400")} />
                    <div className="flex-1 truncate">
                      <span className="font-medium">{item.label}</span>
                      {item.subtitle ? (
                        <span className="text-[10px] text-slate-400 ml-1.5 hidden sm:inline">
                          {item.subtitle}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Persistent Storage & Access Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 space-y-1.5">
        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] truncate" title="Data stored persistently on host filesystem">
          <FolderGit2 className="h-3 w-3 text-emerald-600 shrink-0" />
          <span className="truncate font-mono">./aakash-data</span>
        </div>
      </div>
    </aside>
  );
}
