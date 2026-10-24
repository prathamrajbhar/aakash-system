"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { putParameterSchema, type PutParameterInput } from "@/lib/validations/ssm";

interface CreateParamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PutParameterInput) => void;
  isLoading: boolean;
  error?: unknown;
}

export function CreateParamDialog({ open, onOpenChange, onSubmit, isLoading, error }: CreateParamDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PutParameterInput>({
    resolver: zodResolver(putParameterSchema),
    defaultValues: { type: "String", overwrite: true },
  });

  const handleFormSubmit = (data: PutParameterInput) => {
    onSubmit(data);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add SSM Parameter</DialogTitle>
          <DialogDescription>Store configuration parameter or encrypted secret value.</DialogDescription>
        </DialogHeader>

        {error ? <ErrorBanner error={error} className="mb-3" /> : null}

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Parameter Name</label>
            <Input placeholder="/app/production/database_url" {...register("name")} error={errors.name?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
              <select
                {...register("type")}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="String">String</option>
                <option value="SecureString">SecureString (Encrypted)</option>
                <option value="StringList">StringList</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
              <Input placeholder="Main DB connection" {...register("description")} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Value</label>
            <textarea
              {...register("value")}
              rows={3}
              placeholder="postgres://user:pass@localhost:5432/db"
              className="w-full font-mono text-xs rounded-lg border border-slate-200 bg-white text-slate-900 p-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {errors.value?.message ? <p className="text-xs text-rose-600 mt-1">{errors.value.message}</p> : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" isLoading={isLoading}>Save Parameter</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
