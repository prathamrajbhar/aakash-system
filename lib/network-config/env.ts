import type { AakashNetworkConfig } from "./types";

/** Public host/port users connect to, from AAKASH_PUBLIC_* env vars. */
export function getEnvNetworkConfig(env: Record<string, string | undefined> = process.env): AakashNetworkConfig {
  const port = Number.parseInt(env.AAKASH_API_PORT ?? "", 10);
  return {
    protocol: env.AAKASH_PUBLIC_PROTOCOL === "https" ? "https" : "http",
    host: env.AAKASH_PUBLIC_HOST?.trim() || "localhost",
    apiPort: Number.isInteger(port) && port > 0 && port <= 65535 ? port : 4566,
  };
}
