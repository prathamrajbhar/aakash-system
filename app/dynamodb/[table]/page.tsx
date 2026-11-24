"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, RefreshCw, Search, Trash2, Database, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyButton } from "@/components/ui/copy-button";
import { apiFetch, apiSend } from "@/lib/api/client";
import {
  plainToTypedItem,
  typedItemToPlain,
  validateTypedItem,
  type TypedItem,
} from "@/lib/dynamodb-json";

interface KeySchemaEntry {
  attributeName: string;
  keyType: "HASH" | "RANGE";
  attributeType: "S" | "N" | "B";
}

interface ItemsPage {
  mode: "scan" | "query";
  items: Record<string, unknown>[];
  rawItems: TypedItem[];
  lastEvaluatedKey: TypedItem | null;
  keySchema: KeySchemaEntry[];
  count: number;
  scannedCount: number;
}

interface QueryFilter {
  pk: string;
  skOp: string;
  sk: string;
  sk2: string;
  order: "asc" | "desc";
}

const EMPTY_FILTER: QueryFilter = { pk: "", skOp: "eq", sk: "", sk2: "", order: "asc" };
const PAGE_SIZE = 50;
const PLAIN_TEMPLATE = '{\n  "id": "item_123",\n  "name": "Sample Item",\n  "active": true\n}';

type EditorMode = "plain" | "typed";

function keyOf(item: TypedItem, schema: KeySchemaEntry[]): TypedItem {
  const key: TypedItem = {};
  for (const { attributeName } of schema) {
    if (item[attributeName]) key[attributeName] = item[attributeName];
  }
  return key;
}

export default function DynamoTableDetailPage() {
  const params = useParams<{ table: string }>();
  const tableName = decodeURIComponent(params.table || "");
  const queryClient = useQueryClient();

  const [draftFilter, setDraftFilter] = useState<QueryFilter>(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState<QueryFilter | null>(null);
  const [showTyped, setShowTyped] = useState(false);

  const [editor, setEditor] = useState<{ open: boolean; isEdit: boolean }>({ open: false, isEdit: false });
  const [editorMode, setEditorMode] = useState<EditorMode>("plain");
  const [editorText, setEditorText] = useState(PLAIN_TEMPLATE);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TypedItem | null>(null);

  const itemsKey = ["dynamodb-items", tableName, appliedFilter] as const;

  const { data, isLoading, error, refetch, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<ItemsPage, Error, { pages: ItemsPage[] }, readonly unknown[], string | undefined>({
      queryKey: itemsKey,
      initialPageParam: undefined,
      queryFn: ({ pageParam }) => {
        const qs = new URLSearchParams({ tableName, limit: String(PAGE_SIZE) });
        if (pageParam) qs.set("exclusiveStartKey", pageParam);
        if (appliedFilter) {
          qs.set("pk", appliedFilter.pk);
          qs.set("order", appliedFilter.order);
          if (appliedFilter.sk) {
            qs.set("sk", appliedFilter.sk);
            qs.set("skOp", appliedFilter.skOp);
            if (appliedFilter.skOp === "between") qs.set("sk2", appliedFilter.sk2);
          }
        }
        return apiFetch<ItemsPage>(`/api/dynamodb/items?${qs.toString()}`);
      },
      getNextPageParam: (last) =>
        last.lastEvaluatedKey ? JSON.stringify(last.lastEvaluatedKey) : undefined,
      enabled: Boolean(tableName),
    });

  const pages = useMemo(() => data?.pages ?? [], [data]);
  const keySchema = pages[0]?.keySchema ?? [];
  const hashKey = keySchema.find((k) => k.keyType === "HASH");
  const rangeKey = keySchema.find((k) => k.keyType === "RANGE");
  const rawItems = useMemo(() => pages.flatMap((p) => p.rawItems), [pages]);
  const plainItems = useMemo(() => pages.flatMap((p) => p.items), [pages]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dynamodb-items", tableName] });

  const saveMutation = useMutation({
    mutationFn: (payload: { item?: Record<string, unknown>; itemRaw?: TypedItem }) =>
      apiSend("/api/dynamodb/items", "POST", { tableName, ...payload }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["dynamodb-tables"] });
      setEditor({ open: false, isEdit: false });
      setEditorError(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (keyRaw: TypedItem) => apiSend("/api/dynamodb/items", "DELETE", { tableName, keyRaw }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["dynamodb-tables"] });
      setItemToDelete(null);
    },
  });

  const openInsert = () => {
    saveMutation.reset();
    setEditorMode("plain");
    setEditorText(PLAIN_TEMPLATE);
    setEditorError(null);
    setEditor({ open: true, isEdit: false });
  };

  // Editing always starts in the lossless typed format so sets, binary and
  // large numbers survive the round trip.
  const openEdit = (item: TypedItem) => {
    saveMutation.reset();
    setEditorMode("typed");
    setEditorText(JSON.stringify(item, null, 2));
    setEditorError(null);
    setEditor({ open: true, isEdit: true });
  };

  const switchEditorMode = (next: EditorMode) => {
    if (next === editorMode) return;
    try {
      const parsed: unknown = JSON.parse(editorText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Item must be a JSON object");
      }
      const converted =
        next === "typed"
          ? plainToTypedItem(parsed as Record<string, unknown>)
          : typedItemToPlain(validateTypedItem(parsed));
      setEditorText(JSON.stringify(converted, null, 2));
      setEditorError(null);
      setEditorMode(next);
    } catch (err) {
      setEditorError(
        `Fix the JSON before switching format: ${err instanceof Error ? err.message : "invalid JSON"}`
      );
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed: unknown = JSON.parse(editorText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Item must be a JSON object");
      }
      setEditorError(null);
      if (editorMode === "typed") {
        saveMutation.mutate({ itemRaw: validateTypedItem(parsed) });
      } else {
        saveMutation.mutate({ item: parsed as Record<string, unknown> });
      }
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Invalid JSON syntax");
    }
  };

  const applyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftFilter.pk.trim()) return;
    setAppliedFilter({ ...draftFilter, pk: draftFilter.pk.trim() });
  };

  const clearFilter = () => {
    setDraftFilter(EMPTY_FILTER);
    setAppliedFilter(null);
  };

  const inputCls =
    "h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900";
  const items = showTyped ? rawItems : plainItems;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dynamodb">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Back to tables">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Database className="h-5 w-5 text-slate-700" />
              <span>{tableName}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
              {keySchema.length === 0 ? (
                <span>Explore, query, edit and insert items.</span>
              ) : (
                keySchema.map((k) => (
                  <span
                    key={k.attributeName}
                    className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700"
                  >
                    {k.keyType === "HASH" ? "partition" : "sort"}: {k.attributeName} ({k.attributeType})
                  </span>
                ))
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={openInsert}>
            <Plus className="h-4 w-4 mr-1.5" />
            Insert Item
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching && !isFetchingNextPage}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner error={error} onRetry={() => refetch()} /> : null}

      {/* Query by key */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={applyFilter} className="flex flex-wrap items-end gap-3">
            <label className="text-[11px] font-semibold text-slate-600 space-y-1">
              <span className="block">{hashKey ? `${hashKey.attributeName} (partition key)` : "Partition key"}</span>
              <input
                className={`${inputCls} w-44`}
                value={draftFilter.pk}
                onChange={(e) => setDraftFilter({ ...draftFilter, pk: e.target.value })}
                placeholder="value"
              />
            </label>
            {rangeKey ? (
              <>
                <label className="text-[11px] font-semibold text-slate-600 space-y-1">
                  <span className="block">{rangeKey.attributeName} (sort key)</span>
                  <span className="flex gap-1.5">
                    <select
                      className={inputCls}
                      value={draftFilter.skOp}
                      onChange={(e) => setDraftFilter({ ...draftFilter, skOp: e.target.value })}
                    >
                      <option value="eq">=</option>
                      <option value="lt">&lt;</option>
                      <option value="lte">&le;</option>
                      <option value="gt">&gt;</option>
                      <option value="gte">&ge;</option>
                      <option value="between">between</option>
                      {rangeKey.attributeType !== "N" ? <option value="begins_with">begins with</option> : null}
                    </select>
                    <input
                      className={`${inputCls} w-36`}
                      value={draftFilter.sk}
                      onChange={(e) => setDraftFilter({ ...draftFilter, sk: e.target.value })}
                      placeholder="optional"
                    />
                    {draftFilter.skOp === "between" ? (
                      <input
                        className={`${inputCls} w-36`}
                        value={draftFilter.sk2}
                        onChange={(e) => setDraftFilter({ ...draftFilter, sk2: e.target.value })}
                        placeholder="and"
                      />
                    ) : null}
                  </span>
                </label>
                <label className="text-[11px] font-semibold text-slate-600 space-y-1">
                  <span className="block">Order</span>
                  <select
                    className={inputCls}
                    value={draftFilter.order}
                    onChange={(e) => setDraftFilter({ ...draftFilter, order: e.target.value as "asc" | "desc" })}
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </label>
              </>
            ) : null}
            <Button type="submit" size="sm" disabled={!draftFilter.pk.trim()}>
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Run Query
            </Button>
            {appliedFilter ? (
              <Button type="button" variant="outline" size="sm" onClick={clearFilter}>
                <X className="h-3.5 w-3.5 mr-1" />
                Clear (back to scan)
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {appliedFilter ? "Query results" : "Scanned items"} ({items.length}
              {hasNextPage ? "+" : ""})
            </CardTitle>
            <CardDescription>
              {appliedFilter
                ? `Items where ${hashKey?.attributeName ?? "partition key"} = ${appliedFilter.pk}`
                : "Items read with a full table scan"}
            </CardDescription>
          </div>
          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setShowTyped(false)}
              className={`px-2.5 py-1 ${!showTyped ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => setShowTyped(true)}
              title="Lossless typed format: shows sets, binary and exact numbers"
              className={`px-2.5 py-1 ${showTyped ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              DynamoDB JSON
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner message="Reading table items..." />
          ) : items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title={appliedFilter ? "No items match this query" : "No items in table"}
                description={
                  appliedFilter
                    ? "Try a different key value, or clear the query to scan the whole table."
                    : "Use the button above to insert an item."
                }
                actionLabel={appliedFilter ? undefined : "Insert Item"}
                onAction={appliedFilter ? undefined : openInsert}
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const raw = rawItems[idx];
                return (
                  <div
                    key={JSON.stringify(keyOf(raw, keySchema)) + idx}
                    className="p-4 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-4"
                  >
                    <pre className="font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto flex-1">
                      {JSON.stringify(item, null, 2)}
                    </pre>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        title="Edit item"
                        onClick={() => openEdit(raw)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <CopyButton text={JSON.stringify(item, null, 2)} />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-rose-600 hover:bg-rose-50"
                        title="Delete item"
                        onClick={() => setItemToDelete(raw)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasNextPage ? (
            <div className="p-4 border-t border-slate-100 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} isLoading={isFetchingNextPage}>
                Load more
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={editor.open}
        onOpenChange={(open) => {
          if (!open) setEditor({ open: false, isEdit: false });
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editor.isEdit ? "Edit Item" : "Insert Item"}</DialogTitle>
            <DialogDescription>
              {editor.isEdit
                ? `Saving replaces the stored item with the same key in ${tableName}. Changing a key attribute creates a new item.`
                : `Add an item to ${tableName}. Key attributes are required.`}
            </DialogDescription>
          </DialogHeader>

          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-[11px] font-medium mb-3">
            <button
              type="button"
              onClick={() => switchEditorMode("plain")}
              className={`px-2.5 py-1 ${editorMode === "plain" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Plain JSON
            </button>
            <button
              type="button"
              onClick={() => switchEditorMode("typed")}
              className={`px-2.5 py-1 ${editorMode === "typed" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              DynamoDB JSON
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mb-2">
            {editorMode === "plain"
              ? 'Strings, numbers, booleans, lists and maps. Use DynamoDB JSON for sets, binary, or numbers over 15 digits.'
              : 'Typed values, e.g. {"id": {"S": "a1"}, "tags": {"SS": ["x", "y"]}}. Binary is base64.'}
          </p>

          {saveMutation.error ? <ErrorBanner error={saveMutation.error} className="mb-3" /> : null}
          {editorError ? <p className="text-xs text-rose-600 mb-2">{editorError}</p> : null}

          <form onSubmit={handleSave} className="space-y-4">
            <textarea
              rows={12}
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              spellCheck={false}
              className="w-full font-mono text-xs rounded-lg border border-slate-200 bg-white text-slate-900 p-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditor({ open: false, isEdit: false })}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={saveMutation.isPending}>
                Save Item
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title="Delete item?"
        description={
          itemToDelete
            ? `This permanently deletes the item with key ${JSON.stringify(typedItemToPlain(keyOf(itemToDelete, keySchema)))}.`
            : ""
        }
        confirmLabel="Delete Item"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => itemToDelete && deleteMutation.mutate(keyOf(itemToDelete, keySchema))}
      />
      {deleteMutation.error ? <ErrorBanner error={deleteMutation.error} /> : null}
    </div>
  );
}
