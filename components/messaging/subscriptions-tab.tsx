"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { createSubscriptionSchema, type CreateSubscriptionInput } from "@/lib/validations/sns-subscription";

interface SubscriptionItem {
  subscriptionArn: string;
  protocol: string;
  endpoint: string;
  topicArn: string;
}

export function SubscriptionsTab({ topics = [] }: { topics?: { topicArn: string; name: string }[] }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [subToDelete, setSubToDelete] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateSubscriptionInput>({
    resolver: zodResolver(createSubscriptionSchema),
    defaultValues: { protocol: "sqs" },
  });

  const { data, isLoading, error, refetch } = useQuery<{ subscriptions: SubscriptionItem[] }>({
    queryKey: ["sns-subscriptions"],
    queryFn: async () => (await fetch("/api/sns/subscriptions")).json(),
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateSubscriptionInput) => {
      const res = await fetch("/api/sns/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sns-subscriptions"] });
      setCreateOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (arn: string) => {
      const res = await fetch(`/api/sns/subscriptions?subscriptionArn=${encodeURIComponent(arn)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sns-subscriptions"] });
      setSubToDelete(null);
    },
  });

  const subscriptions = data?.subscriptions || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Topic Subscriptions</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Subscription
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner error={error} onRetry={() => refetch()} /> : null}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner message="Fetching subscriptions..." />
          ) : subscriptions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No Topic Subscriptions"
                description="Link an SQS queue or email endpoint to an SNS topic for automatic fan-out."
                actionLabel="Add Subscription"
                onAction={() => setCreateOpen(true)}
              />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Topic</th>
                  <th className="py-3 px-5">Protocol</th>
                  <th className="py-3 px-5">Endpoint Destination</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.map((s) => (
                  <tr key={s.subscriptionArn} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900 truncate max-w-xs">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-slate-500 shrink-0" />
                        <span className="truncate">{s.topicArn.split(":").pop() || s.topicArn}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-xs">
                      <Badge variant="info">{s.protocol.toUpperCase()}</Badge>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-xs text-slate-700 truncate max-w-sm">{s.endpoint}</td>
                    <td className="py-3.5 px-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-rose-600 hover:bg-rose-50"
                        onClick={() => setSubToDelete(s.subscriptionArn)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscribe Endpoint to Topic</DialogTitle>
            <DialogDescription>Route published topic messages to an SQS queue or email.</DialogDescription>
          </DialogHeader>

          {createMutation.error ? <ErrorBanner error={createMutation.error} className="mb-3" /> : null}

          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Topic</label>
              {topics.length > 0 ? (
                <select
                  {...register("topicArn")}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {topics.map((t) => (
                    <option key={t.topicArn} value={t.topicArn}>{t.name} ({t.topicArn})</option>
                  ))}
                </select>
              ) : (
                <Input placeholder="arn:aws:sns:us-east-1:000000000000:my-topic" {...register("topicArn")} error={errors.topicArn?.message} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Protocol</label>
                <select
                  {...register("protocol")}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="sqs">SQS Queue</option>
                  <option value="email">Email</option>
                  <option value="http">HTTP Endpoint</option>
                  <option value="https">HTTPS Endpoint</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Endpoint (Queue ARN / Email / URL)</label>
                <Input placeholder="arn:aws:sqs:... or dev@local.test" {...register("endpoint")} error={errors.endpoint?.message} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" isLoading={createMutation.isPending}>Subscribe</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(subToDelete)}
        onOpenChange={(o) => !o && setSubToDelete(null)}
        title="Unsubscribe Endpoint?"
        description="Are you sure you want to delete this subscription? Messages published to the topic will no longer be forwarded."
        confirmLabel="Unsubscribe"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => subToDelete && deleteMutation.mutate(subToDelete)}
      />
    </div>
  );
}
