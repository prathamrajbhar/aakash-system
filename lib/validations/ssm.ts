import { z } from "zod";

export const putParameterSchema = z.object({
  name: z
    .string()
    .min(1, "Parameter name is required")
    .max(2048, "Parameter name max length is 2048")
    .regex(/^[a-zA-Z0-9_.\-\/]+$/, "Allowed characters: letters, numbers, hyphens, periods, underscores, forward slashes"),
  value: z.string().min(1, "Parameter value is required"),
  type: z.enum(["String", "StringList", "SecureString"]).default("String"),
  description: z.string().optional(),
  overwrite: z.boolean().default(true),
});

export type PutParameterInput = z.infer<typeof putParameterSchema>;

export const deleteParameterSchema = z.object({
  name: z.string().min(1, "Parameter name is required"),
});

export type DeleteParameterInput = z.infer<typeof deleteParameterSchema>;
