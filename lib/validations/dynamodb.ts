import { z } from "zod";

export const createTableSchema = z.object({
  tableName: z
    .string()
    .min(3, "Table name must be at least 3 characters")
    .max(255, "Table name must be at most 255 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Table name may only contain letters, numbers, underscores, dots, and hyphens"),
  partitionKeyName: z
    .string()
    .min(1, "Partition key name is required")
    .max(255, "Partition key name must be at most 255 characters"),
  partitionKeyType: z.enum(["S", "N", "B"]),
  sortKeyName: z.string().optional(),
  sortKeyType: z.enum(["S", "N", "B"]).optional(),
  billingMode: z.enum(["PAY_PER_REQUEST", "PROVISIONED"]).default("PAY_PER_REQUEST"),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;

export const putItemSchema = z.object({
  tableName: z.string().min(1, "Table name is required"),
  itemJson: z.string().min(2, "Valid JSON object required"),
});

export type PutItemInput = z.infer<typeof putItemSchema>;

export const deleteItemSchema = z.object({
  tableName: z.string().min(1, "Table name is required"),
  keyJson: z.string().min(2, "Valid Key JSON object required"),
});

export type DeleteItemInput = z.infer<typeof deleteItemSchema>;
