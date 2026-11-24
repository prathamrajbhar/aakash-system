import { NextRequest, NextResponse } from "next/server";
import {
  DeleteItemCommand,
  DescribeTableCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { getDynamoDBClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import {
  itemToTyped,
  marshallItem,
  typedItemToAttributes,
} from "@/lib/aws/dynamodb-utils";
import { DynamoJsonError, typedItemToPlain } from "@/lib/dynamodb-json";
import { errorResponse, intParam, missingParam, readJson } from "@/lib/api/server";

export const dynamic = "force-dynamic";

type ScalarType = "S" | "N" | "B";

interface TableKeyInfo {
  hashName: string;
  hashType: ScalarType;
  rangeName?: string;
  rangeType?: ScalarType;
  keySchema: { attributeName: string; keyType: "HASH" | "RANGE"; attributeType: ScalarType }[];
}

async function describeKeys(tableName: string): Promise<TableKeyInfo> {
  const res = await getDynamoDBClient().send(new DescribeTableCommand({ TableName: tableName }));
  const defs = new Map(
    (res.Table?.AttributeDefinitions || []).map((d) => [d.AttributeName, d.AttributeType])
  );
  const keySchema = (res.Table?.KeySchema || []).map((k) => ({
    attributeName: k.AttributeName || "",
    keyType: (k.KeyType === "RANGE" ? "RANGE" : "HASH") as "HASH" | "RANGE",
    attributeType: (defs.get(k.AttributeName) as ScalarType | undefined) || "S",
  }));
  const hash = keySchema.find((k) => k.keyType === "HASH");
  const range = keySchema.find((k) => k.keyType === "RANGE");
  if (!hash) throw new DynamoJsonError(`Table ${tableName} has no partition key`);
  return {
    hashName: hash.attributeName,
    hashType: hash.attributeType,
    rangeName: range?.attributeName,
    rangeType: range?.attributeType,
    keySchema,
  };
}

/** Turns the text a user typed into a key attribute of the table's declared type. */
function keyValue(raw: string, type: ScalarType, label: string): AttributeValue {
  if (type === "N") {
    if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(raw.trim())) {
      throw new DynamoJsonError(`${label} must be a number`);
    }
    return { N: raw.trim() };
  }
  if (type === "B") return { B: Buffer.from(raw, "base64") };
  return { S: raw };
}

function parseExclusiveStartKey(raw: string | null): Record<string, AttributeValue> | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DynamoJsonError("exclusiveStartKey must be valid JSON");
  }
  return typedItemToAttributes(parsed);
}

/** Keeps only the key attributes — strict backends reject extra attributes in `Key`. */
function pickKey(
  attrs: Record<string, AttributeValue>,
  info: TableKeyInfo
): Record<string, AttributeValue> {
  const key: Record<string, AttributeValue> = {};
  for (const { attributeName } of info.keySchema) {
    if (!(attributeName in attrs)) {
      throw new DynamoJsonError(`Missing key attribute "${attributeName}"`);
    }
    key[attributeName] = attrs[attributeName];
  }
  return key;
}

const SORT_OPERATORS: Record<string, string> = {
  eq: "=",
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get("tableName");
    if (!tableName) return missingParam("tableName");

    const limit = intParam(searchParams.get("limit"), 50, 1, 100);
    const exclusiveStartKey = parseExclusiveStartKey(searchParams.get("exclusiveStartKey"));
    const info = await describeKeys(tableName);
    const client = getDynamoDBClient();

    const pk = searchParams.get("pk");
    const isQuery = pk !== null && pk !== "";

    let items: Record<string, AttributeValue>[] = [];
    let lastEvaluatedKey: Record<string, AttributeValue> | undefined;
    let count = 0;
    let scannedCount = 0;

    if (isQuery) {
      const names: Record<string, string> = { "#pk": info.hashName };
      const values: Record<string, AttributeValue> = {
        ":pk": keyValue(pk, info.hashType, `Partition key "${info.hashName}"`),
      };
      let expression = "#pk = :pk";

      const sk = searchParams.get("sk");
      if (sk !== null && sk !== "") {
        if (!info.rangeName || !info.rangeType) {
          throw new DynamoJsonError("This table has no sort key");
        }
        const op = searchParams.get("skOp") || "eq";
        names["#sk"] = info.rangeName;
        values[":sk"] = keyValue(sk, info.rangeType, `Sort key "${info.rangeName}"`);
        if (op === "begins_with") {
          if (info.rangeType === "N") throw new DynamoJsonError("begins_with needs a string or binary sort key");
          expression += " AND begins_with(#sk, :sk)";
        } else if (op === "between") {
          const sk2 = searchParams.get("sk2");
          if (!sk2) throw new DynamoJsonError("between needs a second sort key value");
          values[":sk2"] = keyValue(sk2, info.rangeType, `Sort key "${info.rangeName}"`);
          expression += " AND #sk BETWEEN :sk AND :sk2";
        } else if (SORT_OPERATORS[op]) {
          expression += ` AND #sk ${SORT_OPERATORS[op]} :sk`;
        } else {
          throw new DynamoJsonError(`Unsupported sort key operator "${op}"`);
        }
      }

      const res = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: expression,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          Limit: limit,
          ExclusiveStartKey: exclusiveStartKey,
          ScanIndexForward: searchParams.get("order") !== "desc",
        })
      );
      items = res.Items || [];
      lastEvaluatedKey = res.LastEvaluatedKey;
      count = res.Count ?? items.length;
      scannedCount = res.ScannedCount ?? items.length;
    } else {
      const res = await client.send(
        new ScanCommand({
          TableName: tableName,
          Limit: limit,
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      items = res.Items || [];
      lastEvaluatedKey = res.LastEvaluatedKey;
      count = res.Count ?? items.length;
      scannedCount = res.ScannedCount ?? items.length;
    }

    const rawItems = items.map(itemToTyped);

    return NextResponse.json({
      mode: isQuery ? "query" : "scan",
      items: rawItems.map(typedItemToPlain),
      rawItems,
      lastEvaluatedKey: lastEvaluatedKey ? itemToTyped(lastEvaluatedKey) : null,
      keySchema: info.keySchema,
      count,
      scannedCount,
    });
  } catch (error) {
    if (error instanceof DynamoJsonError) {
      return errorResponse("ValidationError", error.message, 400);
    }
    return handleAwsError(error, "DYNAMODB_SCAN_ITEMS");
  }
}

interface PutBody {
  tableName?: string;
  /** Plain JSON item (strings, numbers, booleans, lists, maps). */
  item?: Record<string, unknown>;
  /** Lossless DynamoDB-JSON item — wins over `item` when both are sent. */
  itemRaw?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<PutBody>(request);
    const { tableName, item, itemRaw } = body;
    const source = itemRaw ?? item;

    if (!tableName || !source || typeof source !== "object" || Array.isArray(source)) {
      return errorResponse("ValidationError", "tableName and an item object are required", 400);
    }

    const attributes = itemRaw ? typedItemToAttributes(itemRaw) : marshallItem(source);
    if (Object.keys(attributes).length === 0) {
      return errorResponse("ValidationError", "Item must have at least one attribute", 400);
    }

    // Fail early with a readable message instead of a backend-specific one.
    const info = await describeKeys(tableName);
    for (const { attributeName } of info.keySchema) {
      if (!(attributeName in attributes)) {
        return errorResponse("ValidationError", `Item is missing key attribute "${attributeName}"`, 400);
      }
    }

    await getDynamoDBClient().send(new PutItemCommand({ TableName: tableName, Item: attributes }));

    return NextResponse.json({ success: true, item: typedItemToPlain(itemToTyped(attributes)) });
  } catch (error) {
    if (error instanceof DynamoJsonError) {
      return errorResponse("ValidationError", error.message, 400);
    }
    return handleAwsError(error, "DYNAMODB_PUT_ITEM");
  }
}

interface DeleteBody {
  tableName?: string;
  key?: Record<string, unknown>;
  keyRaw?: Record<string, unknown>;
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await readJson<DeleteBody>(request);
    const { tableName, key, keyRaw } = body;
    const source = keyRaw ?? key;

    if (!tableName || !source || typeof source !== "object" || Array.isArray(source)) {
      return errorResponse("ValidationError", "tableName and a key object are required", 400);
    }

    const info = await describeKeys(tableName);
    const attributes = keyRaw ? typedItemToAttributes(keyRaw) : marshallItem(source);

    await getDynamoDBClient().send(
      new DeleteItemCommand({ TableName: tableName, Key: pickKey(attributes, info) })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DynamoJsonError) {
      return errorResponse("ValidationError", error.message, 400);
    }
    return handleAwsError(error, "DYNAMODB_DELETE_ITEM");
  }
}
