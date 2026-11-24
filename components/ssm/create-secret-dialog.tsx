"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { createSecretSchema, type CreateSecretInput } from "@/lib/validations/secrets";

interface CreateSecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateSecretInput) => void;
  isLoading: boolean;
  error?: unknown;
}

export function CreateSecretDialog({ open, onOpenChange, onSubmit, isLoading, error }: CreateSecretDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSecretInput>({
    resolver: zodResolver(createSecretSchema),
  });

  const handleFormSubmit = (data: CreateSecretInput) => {
    onSubmit(data);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Secret</DialogTitle>
          <DialogDescription>Store encrypted credentials in Secrets Manager.</DialogDescription>
        </DialogHeader>

        {error ? <ErrorBanner error={error} className="mb-3" /> : null}

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Secret Name</label>
            <Input placeholder="prod/api/stripe_secret_key" {...register("name")} error={errors.name?.message} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
            <Input placeholder="Stripe production API key" {...register("description")} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Secret Value (Plaintext or JSON)</label>
            <textarea
              {...register("secretString")}
              rows={4}
              placeholder='{"username": "admin", "password": "supersecretpassword"}'
              className="w-full font-mono text-xs rounded-lg border border-slate-200 bg-white text-slate-900 p-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {errors.secretString?.message ? <p className="text-xs text-rose-600 mt-1">{errors.secretString.message}</p> : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" isLoading={isLoading}>Save Secret</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
