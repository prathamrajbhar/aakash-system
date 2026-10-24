import os from "node:os";
import type { NextConfig } from "next";

// Only emit the standalone server bundle for container builds.
// Local `npm run build && npm run start` keeps using the regular Next.js output.
const isStandalone = process.env.NEXT_OUTPUT === "standalone";

// Allow the dev server to be reached from the machine's current LAN addresses
// (and the configured public host) without hard-coding a stale IP.
const lanHosts = Object.values(os.networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => address.family === "IPv4" && !address.internal)
  .map((address) => address.address);

const publicHost = process.env.AAKASH_PUBLIC_HOST?.trim();
const allowedDevOrigins = Array.from(
  new Set(["localhost", "127.0.0.1", ...lanHosts, ...(publicHost ? [publicHost] : [])])
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStandalone ? { output: "standalone" as const } : {}),
  serverExternalPackages: ["pino", "pino-pretty"],
  allowedDevOrigins,
};

export default nextConfig;
