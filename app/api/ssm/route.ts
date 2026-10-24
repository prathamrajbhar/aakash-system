import { NextRequest, NextResponse } from "next/server";
import {
  DescribeParametersCommand,
  GetParametersCommand,
  PutParameterCommand,
  DeleteParameterCommand,
} from "@aws-sdk/client-ssm";
import { getSSMClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { putParameterSchema } from "@/lib/validations/ssm";

export async function GET() {
  try {
    const client = getSSMClient();
    const descRes = await client.send(new DescribeParametersCommand({ MaxResults: 50 }));
    const paramDescriptions = descRes.Parameters || [];

    if (paramDescriptions.length === 0) {
      return NextResponse.json({ parameters: [], count: 0 });
    }

    const names = paramDescriptions.map((p) => p.Name).filter((n): n is string => Boolean(n));

    // Fetch parameter values with decryption
    const getRes = await client.send(
      new GetParametersCommand({
        Names: names,
        WithDecryption: true,
      })
    );

    const valueMap = new Map((getRes.Parameters || []).map((p) => [p.Name, p.Value]));

    const parameters = paramDescriptions.map((p) => ({
      name: p.Name || "",
      type: p.Type || "String",
      description: p.Description || "",
      version: p.Version ?? 1,
      lastModifiedDate: p.LastModifiedDate?.toISOString(),
      value: valueMap.get(p.Name) || "",
    }));

    return NextResponse.json({ parameters, count: parameters.length });
  } catch (error) {
    return handleAwsError(error, "SSM_GET_PARAMETERS");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = putParameterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { name, value, type, description, overwrite } = validation.data;
    const client = getSSMClient();

    const command = new PutParameterCommand({
      Name: name,
      Value: value,
      Type: type,
      Description: description,
      Overwrite: overwrite,
    });

    const response = await client.send(command);

    return NextResponse.json({
      success: true,
      parameter: {
        name,
        type,
        version: response.Version,
      },
    });
  } catch (error) {
    return handleAwsError(error, "SSM_PUT_PARAMETER");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "name query parameter is required" } },
        { status: 400 }
      );
    }

    const client = getSSMClient();
    await client.send(new DeleteParameterCommand({ Name: name }));

    return NextResponse.json({ success: true, name });
  } catch (error) {
    return handleAwsError(error, "SSM_DELETE_PARAMETER");
  }
}
