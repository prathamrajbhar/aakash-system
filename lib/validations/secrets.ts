import { z } from "zod";

export const createSecretSchema = z.object({
  name: z
    .string()
    .min(1, "Secret name is required")
    .max(512, "Secret name max length is 512")
    .regex(/^[a-zA-Z0-9_.\-\/]+$/, "Allowed characters: letters, numbers, hyphens, periods, underscores, forward slashes"),
  secretString: z.string().min(1, "Secret content is required"),
  description: z.string().optional(),
});

export type CreateSecretInput = z.infer<typeof createSecretSchema>;

export const deleteSecretSchema = z.object({
  name: z.string().min(1, "Secret name is required"),
  recoveryWindowInDays: z.number().optional().default(0),
});

export type DeleteSecretInput = z.infer<typeof deleteSecretSchema>;
