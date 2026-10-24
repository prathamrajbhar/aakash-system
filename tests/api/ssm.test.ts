import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  SSMClient,
  DescribeParametersCommand,
  GetParametersCommand,
  PutParameterCommand,
} from "@aws-sdk/client-ssm";
import { GET, POST } from "@/app/api/ssm/route";
import { NextRequest } from "next/server";

const ssmMock = mockClient(SSMClient);

describe("SSM API Route Handlers", () => {
  beforeEach(() => {
    ssmMock.reset();
  });

  it("GET /api/ssm returns parameters with decrypted values", async () => {
    ssmMock.on(DescribeParametersCommand).resolves({
      Parameters: [
        { Name: "/app/prod/api_url", Type: "String", Version: 1 },
      ],
    });
    ssmMock.on(GetParametersCommand).resolves({
      Parameters: [
        { Name: "/app/prod/api_url", Value: "https://api.example.com" },
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.parameters).toHaveLength(1);
    expect(data.parameters[0].name).toBe("/app/prod/api_url");
    expect(data.parameters[0].value).toBe("https://api.example.com");
  });

  it("POST /api/ssm stores a parameter", async () => {
    ssmMock.on(PutParameterCommand).resolves({
      Version: 2,
    });

    const req = new NextRequest("http://localhost:3000/api/ssm", {
      method: "POST",
      body: JSON.stringify({
        name: "/app/prod/secret_token",
        value: "xyz123",
        type: "SecureString",
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.parameter.name).toBe("/app/prod/secret_token");
  });
});
