"use client";

import React, { useState } from "react";
import { ApiError, apiFetch, apiSend } from "@/lib/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { HardDrive, Plus, Trash2, ExternalLink, Terminal, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyButton } from "@/components/ui/copy-button";
import { useNetworkConfig } from "@/components/providers/network-provider";
import { formatDate } from "@/lib/utils";
import { createBucketSchema, type CreateBucketInput } from "@/lib/validations/s3";

interface BucketItem {
  name: string;
  creationDate?: string;
}

export default function S3Page() {
  const queryClient = useQueryClient();
  const { awsCliSnippet, apiEndpoint } = useNetworkConfig();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bucketToDelete, setBucketToDelete] = useState<string | null>(null);
  // Set when a delete failed because the bucket still has objects.
  const [bucketToForceDelete, setBucketToForceDelete] = useState<string | null>(null);
  const [showCliSnippet, setShowCliSnippet] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBucketInput>({
    resolver: zodResolver(createBucketSchema),
  });

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<{ buckets: BucketItem[] }>({
    queryKey: ["s3-buckets"],
    queryFn: () => apiFetch("/api/s3"),
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateBucketInput) => {
      const res = await fetch("/api/s3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["s3-buckets"] });
      setCreateDialogOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ bucketName, force }: { bucketName: string; force?: boolean }) =>
      apiSend("/api/s3", "DELETE", { bucketName, force }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["s3-buckets"] });
      setBucketToDelete(null);
      setBucketToForceDelete(null);
    },
    onError: (err, { bucketName, force }) => {
      // Real S3 refuses to delete a non-empty bucket: offer to empty it first.
      if (!force && err instanceof ApiError && err.code === "BucketNotEmpty") {
        setBucketToDelete(null);
        setBucketToForceDelete(bucketName);
      }
    },
  });

  const buckets = data?.buckets || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">S3 Buckets</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage S3 object storage buckets reachable at <code className="font-mono text-xs text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{apiEndpoint}</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCliSnippet(true)}>
            <Terminal className="h-4 w-4 mr-1.5 text-slate-600" />
            AWS CLI Config
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Bucket
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner error={error} onRetry={() => refetch()} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Buckets ({buckets.length})</CardTitle>
          <CardDescription>
            All S3 buckets provisioned in your Aakash instance
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner message="Fetching S3 buckets..." />
          ) : buckets.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No buckets found"
                description="Create your first S3 bucket to start storing objects."
                actionLabel="Create Bucket"
                onAction={() => setCreateDialogOpen(true)}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Bucket Name</th>
                    <th className="py-3 px-5">Created At</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {buckets.map((b) => (
                    <tr key={b.name} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5 font-medium text-slate-900">
                        <Link
                          href={`/s3/${b.name}`}
                          className="flex items-center gap-2 text-slate-900 hover:text-slate-950 transition-colors"
                        >
                          <HardDrive className="h-4 w-4 text-emerald-600" />
                          <span>{b.name}</span>
                        </Link>
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 font-mono text-xs">
                        {formatDate(b.creationDate)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/s3/${b.name}`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-slate-900">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />
                              Browse
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => setBucketToDelete(b.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AWS CLI Config Dialog */}
      <Dialog open={showCliSnippet} onOpenChange={setShowCliSnippet}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>AWS CLI Configuration</DialogTitle>
            <DialogDescription>
              Configure the AWS CLI on your client machine to connect to this Aakash instance:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="relative">
              <pre className="p-3 bg-slate-950 text-slate-200 border border-slate-800 font-mono text-xs rounded-lg overflow-x-auto whitespace-pre">
                {awsCliSnippet}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={awsCliSnippet} label="Copy Snippet" />
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 flex items-start gap-2 text-xs">
              <Shield className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                These environment variables point the AWS CLI directly to your endpoint at <code className="font-mono font-semibold text-slate-900">{apiEndpoint}</code>.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowCliSnippet(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Bucket Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create S3 Bucket</DialogTitle>
            <DialogDescription>
              Bucket names must be globally unique and adhere to S3 naming standards.
            </DialogDescription>
          </DialogHeader>

          {createMutation.error ? (
            <ErrorBanner error={createMutation.error} className="mb-4" />
          ) : null}

          <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Bucket Name
              </label>
              <Input
                placeholder="my-local-bucket"
                {...register("bucketName")}
                error={errors.bucketName?.message}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={createMutation.isPending}>
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(bucketToDelete)}
        onOpenChange={(open) => !open && setBucketToDelete(null)}
        title={`Delete Bucket "${bucketToDelete}"?`}
        description="Are you sure you want to delete this bucket? If it still contains objects you will be asked whether to empty it first."
        confirmLabel="Delete Bucket"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => bucketToDelete && deleteMutation.mutate({ bucketName: bucketToDelete })}
      />

      <ConfirmDialog
        open={Boolean(bucketToForceDelete)}
        onOpenChange={(open) => !open && setBucketToForceDelete(null)}
        title={`Bucket "${bucketToForceDelete}" is not empty`}
        description="Delete every object in this bucket, then delete the bucket itself? This cannot be undone."
        confirmLabel="Empty & Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          bucketToForceDelete && deleteMutation.mutate({ bucketName: bucketToForceDelete, force: true })
        }
      />
      {deleteMutation.error && !bucketToForceDelete ? (
        <ErrorBanner error={deleteMutation.error} />
      ) : null}
    </div>
  );
}
