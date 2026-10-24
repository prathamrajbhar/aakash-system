import { NextRequest, NextResponse } from "next/server";
import { FilterLogEventsCommand, DescribeLogStreamsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { getCloudWatchLogsClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logGroupName = searchParams.get("logGroupName");
    const filterPattern = searchParams.get("filterPattern") || undefined;
    const limit = Number(searchParams.get("limit") || 100);

    if (!logGroupName) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "logGroupName query parameter is required" } },
        { status: 400 }
      );
    }

    const client = getCloudWatchLogsClient();

    // Fetch available streams
    let streams: string[] = [];
    try {
      const streamRes = await client.send(
        new DescribeLogStreamsCommand({
          logGroupName,
          descending: true,
          limit: 20,
        })
      );
      streams = (streamRes.logStreams || []).map((s) => s.logStreamName).filter((n): n is string => Boolean(n));
    } catch {
      streams = [];
    }

    // Filter events across log group
    const eventRes = await client.send(
      new FilterLogEventsCommand({
        logGroupName,
        filterPattern,
        limit,
        interleaved: true,
      })
    );

    const events = (eventRes.events || []).map((e) => ({
      eventId: e.eventId || "",
      logStreamName: e.logStreamName || "",
      timestamp: e.timestamp ? new Date(e.timestamp).toISOString() : "",
      message: e.message || "",
    }));

    return NextResponse.json({
      logGroupName,
      streams,
      events,
      count: events.length,
    });
  } catch (error) {
    return handleAwsError(error, "CW_LOGS_FILTER_EVENTS");
  }
}
