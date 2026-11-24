import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import {
  DynamoJsonError,
  plainToTyped,
  typedToPlain,
  validateTyped,
  type TypedAttr,
  type TypedItem,
} from "../dynamodb-json";

/** SDK AttributeValue -> typed (JSON-safe) attribute. Binary becomes base64. */
export function attributeToTyped(attr: AttributeValue): TypedAttr {
  if (attr.S !== undefined) return { S: attr.S };
  if (attr.N !== undefined) return { N: attr.N };
  if (attr.B !== undefined) return { B: Buffer.from(attr.B).toString("base64") };
  if (attr.BOOL !== undefined) return { BOOL: attr.BOOL };
  if (attr.NULL) return { NULL: true };
  if (attr.SS !== undefined) return { SS: attr.SS };
  if (attr.NS !== undefined) return { NS: attr.NS };
  if (attr.BS !== undefined) return { BS: attr.BS.map((b) => Buffer.from(b).toString("base64")) };
  if (attr.L !== undefined) return { L: attr.L.map(attributeToTyped) };
  if (attr.M !== undefined) {
    const map: Record<string, TypedAttr> = {};
    for (const [k, v] of Object.entries(attr.M)) map[k] = attributeToTyped(v);
    return { M: map };
  }
  return { NULL: true };
}

/** Typed (already validated) attribute -> SDK AttributeValue. */
export function typedToAttribute(attr: TypedAttr): AttributeValue {
  if ("S" in attr) return { S: attr.S };
  if ("N" in attr) return { N: attr.N };
  if ("B" in attr) return { B: Buffer.from(attr.B, "base64") };
  if ("BOOL" in attr) return { BOOL: attr.BOOL };
  if ("NULL" in attr) return { NULL: true };
  if ("SS" in attr) return { SS: attr.SS };
  if ("NS" in attr) return { NS: attr.NS };
  if ("BS" in attr) return { BS: attr.BS.map((b) => Buffer.from(b, "base64")) };
  if ("L" in attr) return { L: attr.L.map(typedToAttribute) };
  const map: Record<string, AttributeValue> = {};
  for (const [k, v] of Object.entries(attr.M)) map[k] = typedToAttribute(v);
  return { M: map };
}

export function itemToTyped(item: Record<string, AttributeValue>): TypedItem {
  const out: TypedItem = {};
  for (const [k, v] of Object.entries(item)) out[k] = attributeToTyped(v);
  return out;
}

/** Validates user-supplied typed JSON and converts it to SDK attribute values. */
export function typedItemToAttributes(raw: unknown): Record<string, AttributeValue> {
  const out: Record<string, AttributeValue> = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new DynamoJsonError("Item must be a JSON object");
  }
  for (const [k, v] of Object.entries(raw)) out[k] = typedToAttribute(validateTyped(v, k));
  return out;
}

// --- Plain-JSON helpers (kept for callers that work with ordinary objects) ---

export function toAttributeValue(value: unknown): AttributeValue {
  return typedToAttribute(plainToTyped(value));
}

export function fromAttributeValue(attr: AttributeValue): unknown {
  return typedToPlain(attributeToTyped(attr));
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
