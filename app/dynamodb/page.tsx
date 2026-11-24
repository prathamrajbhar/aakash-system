"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Database, Plus, RefreshCw, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { createTableSchema, type CreateTableInput } from "@/lib/validations/dynamodb";
import { apiFetch } from "@/lib/api/client";

interface DynamoTableItem {
  tableName: string;
  status: string;
  itemCount: number;
  tableSizeBytes: number;
  creationDateTime?: string;
  keySchema: { AttributeName: string; KeyType: string }[];
}

export default function DynamoDBPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTableInput>({
    resolver: zodResolver(createTableSchema),
    defaultValues: {
      partitionKeyType: "S",
      billingMode: "PAY_PER_REQUEST",
    },
  });

  const { data, isLoading, error, refetch } = useQuery<{ tables: DynamoTableItem[] }>({
    queryKey: ["dynamodb-tables"],
    queryFn: () => apiFetch("/api/dynamodb"),
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateTableInput) => {
      const res = await fetch("/api/dynamodb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamodb-tables"] });
      setCreateDialogOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (tableName: string) => {
      const res = await fetch(`/api/dynamodb?tableName=${encodeURIComponent(tableName)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamodb-tables"] });
      setTableToDelete(null);
    },
  });

  const tables = data?.tables || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">DynamoDB Tables</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage local NoSQL tables, inspect items, and query key schemas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Table
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner error={error} onRetry={() => refetch()} /> : null}

      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle>Tables ({tables.length})</CardTitle>
          <CardDescription>Available local DynamoDB collections</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner message="Fetching DynamoDB tables..." />
          ) : tables.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No DynamoDB tables"
                description="Create a table with partition and sort keys to start storing items."
                actionLabel="Create Table"
                onAction={() => setCreateDialogOpen(true)}
              />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Table Name</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Keys</th>
                  <th className="py-3 px-5">Items</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tables.map((t) => (
                  <tr key={t.tableName} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900">
                      <Link href={`/dynamodb/${t.tableName}`} className="flex items-center gap-2 hover:underline">
                        <Database className="h-4 w-4 text-slate-500" />
                        <span>{t.tableName}</span>
                      </Link>
                    </td>
                    <td className="py-3.5 px-5 text-xs">
                      <Badge variant="success">{t.status}</Badge>
                    </td>
                    <td className="py-3.5 px-5 text-xs font-mono text-slate-600">
                      {t.keySchema.map((k) => `${k.AttributeName} (${k.KeyType})`).join(", ")}
                    </td>
                    <td className="py-3.5 px-5 text-xs font-mono text-slate-600">{t.itemCount}</td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/dynamodb/${t.tableName}`}>
                          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
                            Explore <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-rose-600 hover:bg-rose-50"
                          onClick={() => setTableToDelete(t.tableName)}
                        >
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create DynamoDB Table</DialogTitle>
            <DialogDescription>Define primary keys and billing configuration.</DialogDescription>
          </DialogHeader>

          {createMutation.error ? <ErrorBanner error={createMutation.error} className="mb-4" /> : null}

          <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Table Name</label>
              <Input placeholder="Users" {...register("tableName")} error={errors.tableName?.message} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Partition Key (HASH)</label>
                <Input placeholder="userId" {...register("partitionKeyName")} error={errors.partitionKeyName?.message} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                <select
                  {...register("partitionKeyType")}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="S">String (S)</option>
                  <option value="N">Number (N)</option>
                  <option value="B">Binary (B)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sort Key (Optional RANGE)</label>
                <Input placeholder="createdAt" {...register("sortKeyName")} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sort Key Type</label>
                <select
                  {...register("sortKeyType")}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="S">String (S)</option>
                  <option value="N">Number (N)</option>
                  <option value="B">Binary (B)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" isLoading={createMutation.isPending}>Create Table</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(tableToDelete)}
        onOpenChange={(open) => !open && setTableToDelete(null)}
        title="Delete DynamoDB Table?"
        description="Are you sure you want to delete this table? All stored records will be permanently lost."
        confirmLabel="Delete Table"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => tableToDelete && deleteMutation.mutate(tableToDelete)}
      />
    </div>
  );
}
