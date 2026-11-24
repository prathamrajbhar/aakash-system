"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Trash2, Search, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateLogGroupDialog } from "@/components/cloudwatch/create-log-group-dialog";
import { formatDate } from "@/lib/utils";
import type { CreateLogGroupInput } from "@/lib/validations/cloudwatch";

interface LogGroupItem {
  logGroupName: string;
  storedBytes: number;
}

interface LogEventItem {
  eventId: string;
  logStreamName: string;
  timestamp: string;
  message: string;
}

export default function CloudWatchPage() {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [filterPattern, setFilterPattern] = useState("");
  const [isLiveTailing, setIsLiveTailing] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

  const { data: groupsData, isLoading: groupsLoading, error: groupsError, refetch: refetchGroups } = useQuery<{ logGroups: LogGroupItem[] }>({
    queryKey: ["cw-log-groups"],
    queryFn: async () => (await fetch("/api/cloudwatch-logs")).json(),
  });

  const activeGroup = selectedGroup || groupsData?.logGroups[0]?.logGroupName || null;

  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useQuery<{ events: LogEventItem[] }>({
    queryKey: ["cw-log-events", activeGroup, filterPattern],
    queryFn: async () => {
      if (!activeGroup) return { events: [] };
      const url = `/api/cloudwatch-logs/events?logGroupName=${encodeURIComponent(activeGroup)}${filterPattern ? `&filterPattern=${encodeURIComponent(filterPattern)}` : ""}`;
      return (await fetch(url)).json();
    },
    enabled: Boolean(activeGroup),
    refetchInterval: isLiveTailing ? 3000 : false,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateLogGroupInput) => {
      const res = await fetch("/api/cloudwatch-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cw-log-groups"] });
      setSelectedGroup(data.logGroup?.logGroupName);
      setCreateDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/cloudwatch-logs?logGroupName=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cw-log-groups"] });
      setSelectedGroup(null);
      setGroupToDelete(null);
    },
  });

  const groups = groupsData?.logGroups || [];
  const events = eventsData?.events || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">CloudWatch Logs</h2>
          <p className="text-xs text-slate-500 mt-1">Live tailing, log stream inspection, and keyword filtering for local cloud runtimes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Create Log Group
          </Button>
          <Button variant="outline" size="sm" onClick={() => { refetchGroups(); if (activeGroup) refetchEvents(); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {groupsError ? <ErrorBanner error={groupsError} onRetry={() => refetchGroups()} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm">Log Groups ({groups.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {groupsLoading ? (
                <LoadingSpinner message="Loading log groups..." />
              ) : groups.length === 0 ? (
                <div className="p-4"><EmptyState title="No Log Groups" description="Create a group to start capturing logs." actionLabel="Create Group" onAction={() => setCreateDialogOpen(true)} /></div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {groups.map((g) => {
                    const isSelected = activeGroup === g.logGroupName;
                    return (
                      <div
                        key={g.logGroupName}
                        onClick={() => setSelectedGroup(g.logGroupName)}
                        className={`p-3 px-4 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                          isSelected ? "bg-slate-100/90 font-semibold text-slate-900" : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="font-mono truncate">{g.logGroupName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-rose-600 hover:bg-rose-50"
                          onClick={(e) => { e.stopPropagation(); setGroupToDelete(g.logGroupName); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-mono">{activeGroup || "Select a Log Group"}</CardTitle>
                <CardDescription className="text-xs">Streaming events &bull; Auto-refresh {isLiveTailing ? "Active (3s)" : "Paused"}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsLiveTailing(!isLiveTailing)}>
                  {isLiveTailing ? <><Pause className="h-3 w-3 mr-1" /> Pause</> : <><Play className="h-3 w-3 mr-1" /> Tail Live</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={filterPattern}
                  onChange={(e) => setFilterPattern(e.target.value)}
                  placeholder="Filter events (e.g. ERROR, Exception, timeout)..."
                  className="pl-8 text-xs"
                />
              </div>

              {eventsLoading && !events.length ? (
                <LoadingSpinner message="Tailing log stream..." />
              ) : events.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No log events found for this filter.</p>
              ) : (
                <div className="space-y-1.5 max-h-[460px] overflow-y-auto bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
                  {events.map((ev) => (
                    <div key={ev.eventId} className="flex items-start gap-2 border-b border-slate-900 pb-1">
                      <span className="text-slate-500 whitespace-nowrap text-[10px]">{formatDate(ev.timestamp)}</span>
                      <span className="text-amber-400/90 whitespace-nowrap text-[10px]">[{ev.logStreamName}]</span>
                      <span className="whitespace-pre-wrap break-all text-slate-200">{ev.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateLogGroupDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSubmit={(d) => createMutation.mutate(d)} isLoading={createMutation.isPending} error={createMutation.error} />
      <ConfirmDialog open={Boolean(groupToDelete)} onOpenChange={(o) => !o && setGroupToDelete(null)} title="Delete Log Group?" description="Permanently delete this log group and discard all stored streams." confirmLabel="Delete" variant="destructive" isLoading={deleteMutation.isPending} onConfirm={() => groupToDelete && deleteMutation.mutate(groupToDelete)} />
    </div>
  );
}
