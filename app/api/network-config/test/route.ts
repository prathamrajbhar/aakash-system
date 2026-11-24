import { NextResponse } from "next/server";
import { testConnectionSchema } from "@/lib/network-config/validation";
import { logger } from "@/lib/logger";
import { BACKEND_PATHS } from "@/lib/backend-paths";
import { resolveServerProbeUrl } from "@/lib/aakash-network-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = testConnectionSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }

    const { protocol, host, apiPort } = parseResult.data;
    const targetUrl = `${protocol}://${host}:${apiPort}`;
    // The settings host is what users type into their own tools. When the
    // dashboard runs in a container, a loopback host points at the dashboard
    // itself, so probe the backend the server actually talks to.
    const probeUrl = resolveServerProbeUrl(targetUrl);

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(`${probeUrl}${BACKEND_PATHS.health}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      let version = "0.1.0";
      let edition = "community";

      if (response && response.ok) {
        try {
          const json = await response.json();
          if (json && typeof json === "object") {
            version = json.version || json.edition || version;
            edition = json.edition || edition;
          }
        } catch {
          // Non-JSON 200 is still healthy
        }

        return NextResponse.json({
          success: true,
          statusCode: response.status,
          latencyMs,
          version,
          edition,
          testedEndpoint: targetUrl,
        });
      } else {
        return NextResponse.json({
          success: false,
          statusCode: response ? response.status : 502,
          latencyMs,
          error: `Endpoint responded with status ${response ? response.status : "connection refused"}.`,
          testedEndpoint: targetUrl,
        });
      }
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
      const errorMsg = isTimeout
        ? "Connection timed out after 4000ms. Check network reachability and firewall rules."
        : fetchErr instanceof Error
        ? fetchErr.message
        : "Failed to connect to endpoint.";

      return NextResponse.json({
        success: false,
        latencyMs,
        error: errorMsg,
        testedEndpoint: targetUrl,
      });
    }
  } catch (error) {
    logger.error({ error }, "Test connection route exception.");
    return NextResponse.json(
      { success: false, error: "Internal server error during connectivity test." },
      { status: 500 }
    );
  }
}
