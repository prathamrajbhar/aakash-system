import { NextRequest, NextResponse } from "next/server";
import {
  ListSecretsCommand,
  GetSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import { getSecretsManagerClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { createSecretSchema } from "@/lib/validations/secrets";

export async function GET() {
  try {
    const client = getSecretsManagerClient();
    const listRes = await client.send(new ListSecretsCommand({ MaxResults: 50 }));
    const secretList = listRes.SecretList || [];

    const secrets = await Promise.all(
      secretList.map(async (s) => {
        let secretString = "";
        try {
          if (s.Name) {
            const val = await client.send(new GetSecretValueCommand({ SecretId: s.Name }));
            secretString = val.SecretString || "";
          }
        } catch {
          secretString = "";
        }

        return {
          arn: s.ARN || "",
          name: s.Name || "",
          description: s.Description || "",
          lastChangedDate: s.LastChangedDate?.toISOString(),
          secretString,
        };
      })
    );

    return NextResponse.json({ secrets, count: secrets.length });
  } catch (error) {
    return handleAwsError(error, "SECRETS_LIST_SECRETS");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createSecretSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { name, secretString, description } = validation.data;
    const client = getSecretsManagerClient();

    const command = new CreateSecretCommand({
      Name: name,
      SecretString: secretString,
      Description: description,
    });

    const response = await client.send(command);

    return NextResponse.json({
      success: true,
      secret: {
        arn: response.ARN,
        name: response.Name,
      },
    });
  } catch (error) {
    return handleAwsError(error, "SECRETS_CREATE_SECRET");
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

    const client = getSecretsManagerClient();
    await client.send(
      new DeleteSecretCommand({
        SecretId: name,
        ForceDeleteWithoutRecovery: true,
      })
    );

    return NextResponse.json({ success: true, name });
  } catch (error) {
    return handleAwsError(error, "SECRETS_DELETE_SECRET");
  }
}
