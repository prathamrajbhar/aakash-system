import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand,
  CreateTableCommand,
} from "@aws-sdk/client-dynamodb";
import { GET, POST } from "@/app/api/dynamodb/route";
import { NextRequest } from "next/server";

const dynamoMock = mockClient(DynamoDBClient);

describe("DynamoDB API Route Handlers", () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  it("GET /api/dynamodb returns list of tables with details", async () => {
    dynamoMock.on(ListTablesCommand).resolves({
      TableNames: ["UsersTable"],
    });
    dynamoMock.on(DescribeTableCommand).resolves({
      Table: {
        TableName: "UsersTable",
        TableStatus: "ACTIVE",
        ItemCount: 42,
        TableSizeBytes: 1024,
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tables).toHaveLength(1);
    expect(data.tables[0].tableName).toBe("UsersTable");
    expect(data.tables[0].itemCount).toBe(42);
  });

  it("POST /api/dynamodb creates a new table", async () => {
    dynamoMock.on(CreateTableCommand).resolves({
      TableDescription: {
        TableName: "OrdersTable",
        TableStatus: "CREATING",
      },
    });

    const req = new NextRequest("http://localhost:3000/api/dynamodb", {
      method: "POST",
      body: JSON.stringify({
        tableName: "OrdersTable",
        partitionKeyName: "orderId",
        partitionKeyType: "S",
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.table.tableName).toBe("OrdersTable");
  });
});
