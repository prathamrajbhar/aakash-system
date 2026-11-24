import { z } from "zod";

export const envSchema = z.object({
  AAKASH_ENDPOINT: z
    .string()
    .url("AAKASH_ENDPOINT must be a valid URL")
    .default("http://localhost:4566"),
  AAKASH_PUBLIC_HOST: z
    .string()
    .min(1, "AAKASH_PUBLIC_HOST is required")
    .default("localhost"),
  AAKASH_PUBLIC_PROTOCOL: z.enum(["http", "https"]).default("http"),
  AAKASH_API_PORT: z.coerce.number().int().min(1).max(65535).default(4566),
  AAKASH_RDS_PORT_RANGE_START: z.coerce.number().int().min(1024).max(65535).default(7001),
  AAKASH_RDS_PORT_RANGE_END: z.coerce.number().int().min(1024).max(65535).default(7099),
  AAKASH_EC2_SSH_PORT_RANGE_START: z.coerce.number().int().min(1024).max(65535).default(2200),
  AAKASH_EC2_SSH_PORT_RANGE_END: z.coerce.number().int().min(1024).max(65535).default(2299),
  AAKASH_ELASTICACHE_PORT_RANGE_START: z.coerce.number().int().min(1024).max(65535).default(6379),
  AAKASH_ELASTICACHE_PORT_RANGE_END: z.coerce.number().int().min(1024).max(65535).default(6399),
  AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID is required").default("test"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY is required").default("test"),
  AWS_REGION: z.string().min(1, "AWS_REGION is required").default("us-east-1"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppConfig = z.infer<typeof envSchema>;

export function getValidatedConfig(customEnv?: Record<string, string | undefined>): AppConfig {
  const envSource = customEnv || process.env;

  const result = envSchema.safeParse({
    AAKASH_ENDPOINT: envSource.AAKASH_ENDPOINT || "http://localhost:4566",
    AAKASH_PUBLIC_HOST: envSource.AAKASH_PUBLIC_HOST || "localhost",
    AAKASH_PUBLIC_PROTOCOL: envSource.AAKASH_PUBLIC_PROTOCOL || "http",
    AAKASH_API_PORT: envSource.AAKASH_API_PORT || 4566,
        AAKASH_RDS_PORT_RANGE_START: envSource.AAKASH_RDS_PORT_RANGE_START || 7001,
    AAKASH_RDS_PORT_RANGE_END: envSource.AAKASH_RDS_PORT_RANGE_END || 7099,
    AAKASH_EC2_SSH_PORT_RANGE_START: envSource.AAKASH_EC2_SSH_PORT_RANGE_START || 2200,
    AAKASH_EC2_SSH_PORT_RANGE_END: envSource.AAKASH_EC2_SSH_PORT_RANGE_END || 2299,
    AAKASH_ELASTICACHE_PORT_RANGE_START: envSource.AAKASH_ELASTICACHE_PORT_RANGE_START || 6379,
    AAKASH_ELASTICACHE_PORT_RANGE_END: envSource.AAKASH_ELASTICACHE_PORT_RANGE_END || 6399,
    AWS_ACCESS_KEY_ID: envSource.AWS_ACCESS_KEY_ID || "test",
    AWS_SECRET_ACCESS_KEY: envSource.AWS_SECRET_ACCESS_KEY || "test",
    AWS_REGION: envSource.AWS_REGION || "us-east-1",
    NODE_ENV: envSource.NODE_ENV || "development",
  });

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join(".")}: ${err.message}`)
      .join(", ");
    throw new Error(`Invalid Aakash Environment Configuration: ${errorDetails}`);
  }

  return result.data;
}

export const awsConfig = getValidatedConfig();
