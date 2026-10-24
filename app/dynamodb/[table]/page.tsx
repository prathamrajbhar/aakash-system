"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, RefreshCw, Trash2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";

export default function DynamoTableDetailPage() {
  const params = useParams<{ table: string }>();
  const tableName = decodeURIComponent(params.table || "");
  const queryClient = useQueryClient();

  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [itemJson, setItemJson] = useState('{\n  "id": "item_123",\n  "name": "Sample Item",\n  "active": true\n}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ items: Record<string, unknown>[]; count: number }>({
    queryKey: ["dynamodb-items", tableName],
    queryFn: async () => (await fetch(`/api/dynamodb/items?tableName=${encodeURIComponent(tableName)}`)).json(),
    enabled: Boolean(tableName),
  });

  const insertMutation = useMutation({
    mutationFn: async (parsedItem: Record<string, unknown>) => {
      const res = await fetch("/api/dynamodb/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName, item: parsedItem }),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamodb-items", tableName] });
      setInsertDialogOpen(false);
      setJsonError(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: Record<string, unknown>) => {
      const res = await fetch("/api/dynamodb/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName, key }),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamodb-items", tableName] });
      setItemToDelete(null);
    },
  });

  const handleInsert = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(itemJson);
      if (typeof parsed !== "object" || parsed === null) throw new Error("Item must be a JSON object");
      setJsonError(null);
      insertMutation.mutate(parsed);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON syntax");
    }
  };

  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dynamodb">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Database className="h-5 w-5 text-slate-700" />
              <span>{tableName}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Explore records and insert items into this collection.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setInsertDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Insert Item
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
          <CardTitle>Scanned Records ({items.length})</CardTitle>
          <CardDescription>Live item payloads from table scan</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner message="Scanning table items..." />
          ) : items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No items in table"
                description="Use the button above to insert a JSON document."
                actionLabel="Insert Item"
                onAction={() => setInsertDialogOpen(true)}
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-4">
                  <pre className="font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto flex-1">
                    {JSON.stringify(item, null, 2)}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-rose-600 hover:bg-rose-50"
                    onClick={() => setItemToDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={insertDialogOpen} onOpenChange={setInsertDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Document</DialogTitle>
            <DialogDescription>Paste a valid JSON item to store in {tableName}.</DialogDescription>
          </DialogHeader>

          {insertMutation.error ? <ErrorBanner error={insertMutation.error} className="mb-3" /> : null}
          {jsonError ? <p className="text-xs text-rose-600 mb-2">{jsonError}</p> : null}

          <form onSubmit={handleInsert} className="space-y-4">
            <textarea
              rows={8}
              value={itemJson}
              onChange={(e) => setItemJson(e.target.value)}
              className="w-full font-mono text-xs rounded-lg border border-slate-200 bg-white text-slate-900 p-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setInsertDialogOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" isLoading={insertMutation.isPending}>Save Item</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title="Delete Item Record?"
        description="Are you sure you want to delete this record from DynamoDB?"
        confirmLabel="Delete Item"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => itemToDelete && deleteMutation.mutate(itemToDelete)}
      />
    </div>
  );
}
