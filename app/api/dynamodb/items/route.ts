import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, PutItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { getDynamoDBClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { marshallItem, unmarshallItem } from "@/lib/aws/dynamodb-utils";

export async function GET(request: NextRequest) {
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
    const limit = Number(searchParams.get("limit") || 50);

    const command = new ScanCommand({
      TableName: tableName,
      Limit: limit,
    });

    const response = await client.send(command);
    const items = (response.Items || []).map(unmarshallItem);

    return NextResponse.json({
      items,
      count: response.Count ?? items.length,
      scannedCount: response.ScannedCount ?? items.length,
    });
  } catch (error) {
    return handleAwsError(error, "DYNAMODB_SCAN_ITEMS");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tableName, item } = body;

    if (!tableName || !item || typeof item !== "object") {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "tableName and item object are required" } },
        { status: 400 }
      );
    }

    const client = getDynamoDBClient();
    const marshalled = marshallItem(item);

    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshalled,
      })
    );

    return NextResponse.json({ success: true, item });
  } catch (error) {
    return handleAwsError(error, "DYNAMODB_PUT_ITEM");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { tableName, key } = body;

    if (!tableName || !key || typeof key !== "object") {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "tableName and key object are required" } },
        { status: 400 }
      );
    }

    const client = getDynamoDBClient();
    const marshalledKey = marshallItem(key);

    await client.send(
      new DeleteItemCommand({
        TableName: tableName,
        Key: marshalledKey,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAwsError(error, "DYNAMODB_DELETE_ITEM");
  }
}
