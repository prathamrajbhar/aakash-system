import { NextRequest, NextResponse } from "next/server";
import {
  ListTablesCommand,
  DescribeTableCommand,
  CreateTableCommand,
  DeleteTableCommand,
  type KeySchemaElement,
  type AttributeDefinition,
} from "@aws-sdk/client-dynamodb";
import { getDynamoDBClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { createTableSchema } from "@/lib/validations/dynamodb";

export async function GET() {
  try {
    const client = getDynamoDBClient();
    const listRes = await client.send(new ListTablesCommand({}));
    const tableNames = listRes.TableNames || [];

    const tables = await Promise.all(
      tableNames.map(async (name) => {
        try {
          const desc = await client.send(new DescribeTableCommand({ TableName: name }));
          const t = desc.Table;
          return {
            tableName: name,
            status: t?.TableStatus || "ACTIVE",
            itemCount: t?.ItemCount ?? 0,
            tableSizeBytes: t?.TableSizeBytes ?? 0,
            creationDateTime: t?.CreationDateTime?.toISOString(),
            keySchema: t?.KeySchema || [],
            attributeDefinitions: t?.AttributeDefinitions || [],
          };
        } catch {
          return {
            tableName: name,
            status: "UNKNOWN",
            itemCount: 0,
            tableSizeBytes: 0,
            keySchema: [],
            attributeDefinitions: [],
          };
        }
      })
    );

    return NextResponse.json({ tables, count: tables.length });
  } catch (error) {
    return handleAwsError(error, "DYNAMODB_LIST_TABLES");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createTableSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { tableName, partitionKeyName, partitionKeyType, sortKeyName, sortKeyType, billingMode } = validation.data;
    const client = getDynamoDBClient();

    const keySchema: KeySchemaElement[] = [
      { AttributeName: partitionKeyName, KeyType: "HASH" },
    ];

    const attributeDefinitions: AttributeDefinition[] = [
      { AttributeName: partitionKeyName, AttributeType: partitionKeyType },
    ];

    if (sortKeyName && sortKeyType) {
      keySchema.push({ AttributeName: sortKeyName, KeyType: "RANGE" });
      attributeDefinitions.push({ AttributeName: sortKeyName, AttributeType: sortKeyType });
    }

    const command = new CreateTableCommand({
      TableName: tableName,
      KeySchema: keySchema,
      AttributeDefinitions: attributeDefinitions,
      BillingMode: billingMode,
    });

    await client.send(command);

    return NextResponse.json({
      success: true,
      table: {
        tableName,
        status: "CREATING",
        keySchema,
      },
    });
  } catch (error) {
    return handleAwsError(error, "DYNAMODB_CREATE_TABLE");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get("tableName");

    if (!tableName) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "tableName query parameter is required" } },
        { status: 400 }
      );
    }

    const client = getDynamoDBClient();
    await client.send(new DeleteTableCommand({ TableName: tableName }));

    return NextResponse.json({ success: true, tableName });
  } catch (error) {
    return handleAwsError(error, "DYNAMODB_DELETE_TABLE");
  }
}
