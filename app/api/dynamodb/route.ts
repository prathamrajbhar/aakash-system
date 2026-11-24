import { NextRequest, NextResponse } from "next/server";
import {
  DescribeTableCommand,
  CreateTableCommand,
  DeleteTableCommand,
  paginateListTables,
  type KeySchemaElement,
  type AttributeDefinition,
} from "@aws-sdk/client-dynamodb";
import { getDynamoDBClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { missingParam, readJson, validationError } from "@/lib/api/server";
import { createTableSchema } from "@/lib/validations/dynamodb";

export async function GET() {
  try {
    const client = getDynamoDBClient();
    // ListTables returns at most 100 names per page — follow every page.
    const tableNames: string[] = [];
    for await (const page of paginateListTables({ client }, {})) {
      tableNames.push(...(page.TableNames || []));
    }

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
    const body = await readJson(request);
    const validation = createTableSchema.safeParse(body);

    if (!validation.success) {
      return validationError(validation.error);
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
      // Real DynamoDB rejects PROVISIONED tables that omit throughput.
      ...(billingMode === "PROVISIONED"
        ? { ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 } }
        : {}),
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
      return missingParam("tableName");
    }

    const client = getDynamoDBClient();
    await client.send(new DeleteTableCommand({ TableName: tableName }));

    return NextResponse.json({ success: true, tableName });
  } catch (error) {
    return handleAwsError(error, "DYNAMODB_DELETE_TABLE");
  }
}
