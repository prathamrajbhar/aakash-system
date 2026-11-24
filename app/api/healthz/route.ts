import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for Docker/Coolify-style health checks. It reports only that
 * the dashboard process is up: no backend calls, no configuration, no secrets.
 * It is the one route the auth middleware leaves open.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
