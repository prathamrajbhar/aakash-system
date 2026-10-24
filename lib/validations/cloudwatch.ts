import { z } from "zod";

export const createLogGroupSchema = z.object({
  logGroupName: z
    .string()
    .min(1, "Log group name is required")
    .max(512, "Log group name must be at most 512 characters")
    .regex(/^[\.\-_/#A-Za-z0-9]+$/, "Valid characters: letters, numbers, periods, hyphens, underscores, slashes, hashes"),
});

export type CreateLogGroupInput = z.infer<typeof createLogGroupSchema>;

export const deleteLogGroupSchema = z.object({
  logGroupName: z.string().min(1, "Log group name is required"),
});

export type DeleteLogGroupInput = z.infer<typeof deleteLogGroupSchema>;
