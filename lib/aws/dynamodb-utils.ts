import type { AttributeValue } from "@aws-sdk/client-dynamodb";

export function toAttributeValue(value: unknown): AttributeValue {
  if (value === null || value === undefined) {
    return { NULL: true };
  }
  if (typeof value === "string") {
    return { S: value };
  }
  if (typeof value === "number") {
    return { N: value.toString() };
  }
  if (typeof value === "boolean") {
    return { BOOL: value };
  }
  if (Array.isArray(value)) {
    return { L: value.map(toAttributeValue) };
  }
  if (typeof value === "object") {
    const map: Record<string, AttributeValue> = {};
    for (const [k, v] of Object.entries(value)) {
      map[k] = toAttributeValue(v);
    }
    return { M: map };
  }
  return { S: String(value) };
}

export function fromAttributeValue(attr: AttributeValue): unknown {
  if (attr.NULL) return null;
  if (attr.BOOL !== undefined) return attr.BOOL;
  if (attr.S !== undefined) return attr.S;
  if (attr.N !== undefined) return Number(attr.N);
  if (attr.B !== undefined) return attr.B;
  if (attr.SS !== undefined) return attr.SS;
  if (attr.NS !== undefined) return attr.NS.map(Number);
  if (attr.BS !== undefined) return attr.BS;
  if (attr.L !== undefined) return attr.L.map(fromAttributeValue);
  if (attr.M !== undefined) {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(attr.M)) {
      res[k] = fromAttributeValue(v);
    }
    return res;
  }
  return null;
}

export function marshallItem(obj: Record<string, unknown>): Record<string, AttributeValue> {
  const result: Record<string, AttributeValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = toAttributeValue(v);
  }
  return result;
}

export function unmarshallItem(item: Record<string, AttributeValue>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    result[k] = fromAttributeValue(v);
  }
  return result;
}
