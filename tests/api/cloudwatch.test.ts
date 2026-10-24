import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  CreateLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { GET, POST } from "@/app/api/cloudwatch-logs/route";
import { NextRequest } from "next/server";

const cwMock = mockClient(CloudWatchLogsClient);

describe("CloudWatch Logs API Route Handlers", () => {
  beforeEach(() => {
    cwMock.reset();
  });

  it("GET /api/cloudwatch-logs returns log groups", async () => {
    cwMock.on(DescribeLogGroupsCommand).resolves({
      logGroups: [
        {
          logGroupName: "/aws/lambda/test-function",
          storedBytes: 2048,
          creationTime: Date.now(),
        },
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.logGroups).toHaveLength(1);
    expect(data.logGroups[0].logGroupName).toBe("/aws/lambda/test-function");
  });

  it("POST /api/cloudwatch-logs creates a log group", async () => {
    cwMock.on(CreateLogGroupCommand).resolves({});

    const req = new NextRequest("http://localhost:3000/api/cloudwatch-logs", {
      method: "POST",
      body: JSON.stringify({
        logGroupName: "/aws/lambda/new-function",
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.logGroup.logGroupName).toBe("/aws/lambda/new-function");
  });
});
