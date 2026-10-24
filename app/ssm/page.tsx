"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import { KeyRound, Sliders, Plus, RefreshCw, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyButton } from "@/components/ui/copy-button";
import { CreateParamDialog } from "@/components/ssm/create-param-dialog";
import { CreateSecretDialog } from "@/components/ssm/create-secret-dialog";
import type { PutParameterInput } from "@/lib/validations/ssm";
import type { CreateSecretInput } from "@/lib/validations/secrets";

interface SSMParamItem {
  name: string;
  type: string;
  value: string;
  description: string;
  version: number;
}

interface SecretItem {
  arn: string;
  name: string;
  description: string;
  secretString: string;
}

export default function SSMSecretsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"ssm" | "secrets">("ssm");
  const [createParamOpen, setCreateParamOpen] = useState(false);
  const [createSecretOpen, setCreateSecretOpen] = useState(false);
  const [paramToDelete, setParamToDelete] = useState<string | null>(null);
  const [secretToDelete, setSecretToDelete] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  const { data: ssmData, isLoading: ssmLoading, error: ssmError, refetch: refetchSSM } = useQuery<{ parameters: SSMParamItem[] }>({
    queryKey: ["ssm-parameters"],
    queryFn: async () => (await fetch("/api/ssm")).json(),
  });

  const { data: secretsData, isLoading: secretsLoading, error: secretsError, refetch: refetchSecrets } = useQuery<{ secrets: SecretItem[] }>({
    queryKey: ["secrets-manager"],
    queryFn: async () => (await fetch("/api/secrets")).json(),
  });

  const putParamMutation = useMutation({
    mutationFn: async (input: PutParameterInput) => {
      const res = await fetch("/api/ssm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ssm-parameters"] });
      setCreateParamOpen(false);
    },
  });

  const deleteParamMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/ssm?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ssm-parameters"] });
      setParamToDelete(null);
    },
  });

  const createSecretMutation = useMutation({
    mutationFn: async (input: CreateSecretInput) => {
      const res = await fetch("/api/secrets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets-manager"] });
      setCreateSecretOpen(false);
    },
  });

  const deleteSecretMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/secrets?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets-manager"] });
      setSecretToDelete(null);
    },
  });

  const parameters = ssmData?.parameters || [];
  const secrets = secretsData?.secrets || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Configuration & Secrets</h2>
          <p className="text-xs text-slate-500 mt-1">Manage SSM Parameter Store paths and Secrets Manager credentials.</p>
        </div>
      </div>

      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as "ssm" | "secrets")} className="space-y-6">
        <Tabs.List className="flex border-b border-slate-200 gap-6">
          <Tabs.Trigger
            value="ssm"
            className={`pb-3 text-sm font-medium border-b-2 cursor-pointer transition-colors ${
              activeTab === "ssm" ? "border-slate-900 text-slate-900 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            SSM Parameter Store ({parameters.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="secrets"
            className={`pb-3 text-sm font-medium border-b-2 cursor-pointer transition-colors ${
              activeTab === "secrets" ? "border-slate-900 text-slate-900 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Secrets Manager ({secrets.length})
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="ssm" className="space-y-4 focus:outline-none">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Parameters List</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setCreateParamOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Parameter
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetchSSM()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
              </Button>
            </div>
          </div>

          {ssmError ? <ErrorBanner error={ssmError} onRetry={() => refetchSSM()} /> : null}

          <Card>
            <CardContent className="p-0">
              {ssmLoading ? (
                <LoadingSpinner message="Fetching parameters..." />
              ) : parameters.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No SSM Parameters" description="Store config paths like /app/prod/api_url." actionLabel="Add Parameter" onAction={() => setCreateParamOpen(true)} />
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-5">Name</th>
                      <th className="py-3 px-5">Type</th>
                      <th className="py-3 px-5">Value</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parameters.map((p) => (
                      <tr key={p.name} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Sliders className="h-4 w-4 text-slate-500" />
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs">
                          <Badge variant={p.type === "SecureString" ? "warning" : "default"}>{p.type}</Badge>
                        </td>
                        <td className="py-3.5 px-5 text-xs font-mono text-slate-700 max-w-xs truncate">{p.value}</td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <CopyButton text={p.value} />
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-rose-600 hover:bg-rose-50" onClick={() => setParamToDelete(p.name)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="secrets" className="space-y-4 focus:outline-none">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Secrets List</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setCreateSecretOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Create Secret
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetchSecrets()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
              </Button>
            </div>
          </div>

          {secretsError ? <ErrorBanner error={secretsError} onRetry={() => refetchSecrets()} /> : null}

          <Card>
            <CardContent className="p-0">
              {secretsLoading ? (
                <LoadingSpinner message="Fetching secrets..." />
              ) : secrets.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No Secrets Found" description="Store credentials or API keys securely." actionLabel="Create Secret" onAction={() => setCreateSecretOpen(true)} />
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-5">Secret Name</th>
                      <th className="py-3 px-5">Description</th>
                      <th className="py-3 px-5">Value</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {secrets.map((s) => {
                      const isRevealed = Boolean(revealedSecrets[s.name]);
                      return (
                        <tr key={s.name} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <KeyRound className="h-4 w-4 text-slate-500" />
                              <span>{s.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-xs text-slate-500">{s.description || "—"}</td>
                          <td className="py-3.5 px-5 text-xs font-mono text-slate-700 max-w-xs truncate">
                            {isRevealed ? s.secretString : "••••••••••••••••"}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => setRevealedSecrets((prev) => ({ ...prev, [s.name]: !isRevealed }))}
                              >
                                {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </Button>
                              <CopyButton text={s.secretString} />
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-rose-600 hover:bg-rose-50" onClick={() => setSecretToDelete(s.name)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>
      </Tabs.Root>

      <CreateParamDialog open={createParamOpen} onOpenChange={setCreateParamOpen} onSubmit={(d) => putParamMutation.mutate(d)} isLoading={putParamMutation.isPending} error={putParamMutation.error} />
      <CreateSecretDialog open={createSecretOpen} onOpenChange={setCreateSecretOpen} onSubmit={(d) => createSecretMutation.mutate(d)} isLoading={createSecretMutation.isPending} error={createSecretMutation.error} />

      <ConfirmDialog open={Boolean(paramToDelete)} onOpenChange={(o) => !o && setParamToDelete(null)} title="Delete Parameter?" description="Are you sure you want to remove this parameter from SSM?" confirmLabel="Delete" variant="destructive" isLoading={deleteParamMutation.isPending} onConfirm={() => paramToDelete && deleteParamMutation.mutate(paramToDelete)} />
      <ConfirmDialog open={Boolean(secretToDelete)} onOpenChange={(o) => !o && setSecretToDelete(null)} title="Delete Secret?" description="Are you sure you want to permanently delete this secret?" confirmLabel="Delete Secret" variant="destructive" isLoading={deleteSecretMutation.isPending} onConfirm={() => secretToDelete && deleteSecretMutation.mutate(secretToDelete)} />
    </div>
  );
}
