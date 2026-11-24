"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { createLogGroupSchema, type CreateLogGroupInput } from "@/lib/validations/cloudwatch";

interface CreateLogGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateLogGroupInput) => void;
  isLoading: boolean;
  error?: unknown;
}

export function CreateLogGroupDialog({ open, onOpenChange, onSubmit, isLoading, error }: CreateLogGroupDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateLogGroupInput>({
    resolver: zodResolver(createLogGroupSchema),
  });

  const handleFormSubmit = (data: CreateLogGroupInput) => {
    onSubmit(data);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Log Group</DialogTitle>
          <DialogDescription>Create a CloudWatch log destination for services or Lambdas.</DialogDescription>
        </DialogHeader>

        {error ? <ErrorBanner error={error} className="mb-3" /> : null}

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Log Group Name</label>
            <Input placeholder="/aws/lambda/order-processor" {...register("logGroupName")} error={errors.logGroupName?.message} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" isLoading={isLoading}>Create Group</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
