import { NextResponse } from "next/server";
import { awsConfig } from "@/lib/aws/config";
import { handleAwsError } from "@/lib/aws/error-handler";
import { getServerNetworkDiagnostics } from "@/lib/aakash-network-server";
import { BACKEND_PATHS } from "@/lib/backend-paths";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics = getServerNetworkDiagnostics();
  const publicEndpoint = diagnostics.apiEndpoint;

  try {
    const healthUrl = `${awsConfig.AAKASH_ENDPOINT}${BACKEND_PATHS.health}`;
    const aakashResponse = await fetch(healthUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (aakashResponse.ok) {
      const body = await aakashResponse.json();
      return NextResponse.json({
        status: "UP",
        networkStatus: diagnostics.mode,
        publicEndpoint,
        version: body.version || "1.0.0",
        services: body.services || {},
        uptime: body.uptime,
        diagnostics,
      });
    }

    return NextResponse.json({
      status: "DOWN",
      networkStatus: diagnostics.mode,
      publicEndpoint,
      version: "unavailable",
      services: {},
      diagnostics,
    });
  } catch (error) {
    return NextResponse.json({
      status: "DOWN",
      networkStatus: diagnostics.mode,
      publicEndpoint,
      version: "unavailable",
      error: error instanceof Error ? error.message : "Unreachable",
      diagnostics,
    });
  }
}

export async function POST() {
  try {
    const resetUrl = `${awsConfig.AAKASH_ENDPOINT}${BACKEND_PATHS.reset}`;
    const response = await fetch(resetUrl, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: "State reset request sent (or Aakash returned non-200)" },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true, message: "Aakash state successfully reset" });
  } catch (error) {
    return handleAwsError(error, "HEALTH_RESET");
  }
}
