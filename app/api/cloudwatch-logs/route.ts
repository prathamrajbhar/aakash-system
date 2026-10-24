import { NextRequest, NextResponse } from "next/server";
import {
  DescribeLogGroupsCommand,
  CreateLogGroupCommand,
  DeleteLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { getCloudWatchLogsClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { createLogGroupSchema } from "@/lib/validations/cloudwatch";

export async function GET() {
  try {
    const client = getCloudWatchLogsClient();
    const response = await client.send(new DescribeLogGroupsCommand({ limit: 50 }));

    const logGroups = (response.logGroups || []).map((lg) => ({
      arn: lg.arn || "",
      logGroupName: lg.logGroupName || "",
      creationTime: lg.creationTime ? new Date(lg.creationTime).toISOString() : "",
      storedBytes: lg.storedBytes ?? 0,
      metricFilterCount: lg.metricFilterCount ?? 0,
    }));

    return NextResponse.json({ logGroups, count: logGroups.length });
  } catch (error) {
    return handleAwsError(error, "CW_LOGS_LIST_GROUPS");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createLogGroupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { logGroupName } = validation.data;
    const client = getCloudWatchLogsClient();

    await client.send(new CreateLogGroupCommand({ logGroupName }));

    return NextResponse.json({
      success: true,
      logGroup: {
        logGroupName,
        creationTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleAwsError(error, "CW_LOGS_CREATE_GROUP");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logGroupName = searchParams.get("logGroupName");

    if (!logGroupName) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "logGroupName query parameter is required" } },
        { status: 400 }
      );
    }

    const client = getCloudWatchLogsClient();
    await client.send(new DeleteLogGroupCommand({ logGroupName }));

    return NextResponse.json({ success: true, logGroupName });
  } catch (error) {
    return handleAwsError(error, "CW_LOGS_DELETE_GROUP");
  }
}
