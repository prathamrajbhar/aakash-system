/**
 * Pure (browser + server safe) helpers for "DynamoDB JSON" — the typed wire
 * format used by the AWS CLI, e.g. `{"id": {"S": "a1"}, "tags": {"SS": ["x"]}}`.
 *
 * Plain JSON cannot represent DynamoDB sets, binary values or numbers with more
 * than ~15 significant digits, so a plain-JSON round trip silently corrupts
 * items (a string set turns into a list, `12345678901234567890` turns into
 * `12345678901234567000`). The typed format is lossless and is what the item
 * editor uses. Binary values are carried as base64 strings.
 */

export type TypedAttr =
  | { S: string }
  | { N: string }
  | { B: string }
  | { BOOL: boolean }
  | { NULL: true }
  | { SS: string[] }
  | { NS: string[] }
  | { BS: string[] }
  | { L: TypedAttr[] }
  | { M: { [key: string]: TypedAttr } };

export type TypedItem = Record<string, TypedAttr>;

export class DynamoJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DynamoJsonError";
  }
}

const TYPE_KEYS = ["S", "N", "B", "BOOL", "NULL", "SS", "NS", "BS", "L", "M"] as const;
const NUMBER_RE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when `numeric` survives a trip through a JS double unchanged. */
export function isLosslessNumber(numeric: string): boolean {
  if (!NUMBER_RE.test(numeric)) return false;
  const mantissa = numeric.replace(/^[-+]/, "").split(/[eE]/)[0].replace(".", "");
  const significant = mantissa.replace(/^0+/, "").replace(/0+$/, "");
  return significant.length <= 15 && Number.isFinite(Number(numeric));
}

function assertStringArray(value: unknown, path: string, check?: (v: string) => string | null) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new DynamoJsonError(`${path}: expected a non-empty array`);
  }
  value.forEach((v, i) => {
    if (typeof v !== "string") throw new DynamoJsonError(`${path}[${i}]: expected a string`);
    const problem = check?.(v);
    if (problem) throw new DynamoJsonError(`${path}[${i}]: ${problem}`);
  });
}

const numberProblem = (v: string) => (NUMBER_RE.test(v) ? null : `"${v}" is not a valid number`);
const base64Problem = (v: string) => (BASE64_RE.test(v) ? null : "not valid base64");

/** Validates an unknown value as a typed attribute and returns it typed. */
export function validateTyped(value: unknown, path = "value"): TypedAttr {
  if (!isRecord(value)) {
    throw new DynamoJsonError(`${path}: expected an object like {"S": "text"}`);
  }
  const keys = Object.keys(value);
  if (keys.length !== 1 || !(TYPE_KEYS as readonly string[]).includes(keys[0])) {
    throw new DynamoJsonError(
      `${path}: expected exactly one type key (${TYPE_KEYS.join(", ")}), got ${
        keys.length ? keys.join(", ") : "none"
      }`
    );
  }

  const type = keys[0] as (typeof TYPE_KEYS)[number];
  const inner = value[type];

  switch (type) {
    case "S":
      if (typeof inner !== "string") throw new DynamoJsonError(`${path}.S: expected a string`);
      return { S: inner };
    case "N":
      if (typeof inner !== "string" || !NUMBER_RE.test(inner)) {
        throw new DynamoJsonError(`${path}.N: expected a numeric string such as "42"`);
      }
      return { N: inner };
    case "B":
      if (typeof inner !== "string" || !BASE64_RE.test(inner)) {
        throw new DynamoJsonError(`${path}.B: expected a base64 string`);
      }
      return { B: inner };
    case "BOOL":
      if (typeof inner !== "boolean") throw new DynamoJsonError(`${path}.BOOL: expected true or false`);
      return { BOOL: inner };
    case "NULL":
      if (inner !== true) throw new DynamoJsonError(`${path}.NULL: expected true`);
      return { NULL: true };
    case "SS":
      assertStringArray(inner, `${path}.SS`);
      return { SS: inner as string[] };
    case "NS":
      assertStringArray(inner, `${path}.NS`, numberProblem);
      return { NS: inner as string[] };
    case "BS":
      assertStringArray(inner, `${path}.BS`, base64Problem);
      return { BS: inner as string[] };
    case "L":
      if (!Array.isArray(inner)) throw new DynamoJsonError(`${path}.L: expected an array`);
      return { L: inner.map((v, i) => validateTyped(v, `${path}.L[${i}]`)) };
    case "M": {
      if (!isRecord(inner)) throw new DynamoJsonError(`${path}.M: expected an object`);
      const map: Record<string, TypedAttr> = {};
      for (const [k, v] of Object.entries(inner)) map[k] = validateTyped(v, `${path}.M.${k}`);
      return { M: map };
    }
  }
}

/** Validates a whole item (`{ attrName: typedValue }`). */
export function validateTypedItem(value: unknown): TypedItem {
  if (!isRecord(value)) throw new DynamoJsonError("Item must be a JSON object");
  const item: TypedItem = {};
  for (const [k, v] of Object.entries(value)) item[k] = validateTyped(v, k);
  if (Object.keys(item).length === 0) throw new DynamoJsonError("Item must have at least one attribute");
  return item;
}

/** Plain JSON -> typed. Strings become S, numbers N, arrays L, objects M. */
export function plainToTyped(value: unknown, path = "value"): TypedAttr {
  if (value === null || value === undefined) return { NULL: true };
  switch (typeof value) {
    case "string":
      return { S: value };
    case "number":
      if (!Number.isFinite(value)) throw new DynamoJsonError(`${path}: numbers must be finite`);
      return { N: String(value) };
    case "boolean":
      return { BOOL: value };
    case "object": {
      if (Array.isArray(value)) {
        return { L: value.map((v, i) => plainToTyped(v, `${path}[${i}]`)) };
      }
      const map: Record<string, TypedAttr> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        map[k] = plainToTyped(v, `${path}.${k}`);
      }
      return { M: map };
    }
    default:
      throw new DynamoJsonError(`${path}: unsupported value type "${typeof value}"`);
  }
}

export function plainToTypedItem(item: Record<string, unknown>): TypedItem {
  const out: TypedItem = {};
  for (const [k, v] of Object.entries(item)) out[k] = plainToTyped(v, k);
  return out;
}

function plainNumber(numeric: string): number | string {
  return isLosslessNumber(numeric) ? Number(numeric) : numeric;
}

/**
 * Typed -> plain JSON for display. Sets become arrays, binary stays base64, and
 * numbers a double cannot hold exactly stay strings instead of being rounded.
 */
export function typedToPlain(attr: TypedAttr): unknown {
  if ("S" in attr) return attr.S;
  if ("N" in attr) return plainNumber(attr.N);
  if ("B" in attr) return attr.B;
  if ("BOOL" in attr) return attr.BOOL;
  if ("NULL" in attr) return null;
  if ("SS" in attr) return attr.SS;
  if ("NS" in attr) return attr.NS.map(plainNumber);
  if ("BS" in attr) return attr.BS;
  if ("L" in attr) return attr.L.map(typedToPlain);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attr.M)) out[k] = typedToPlain(v);
  return out;
}

export function typedItemToPlain(item: TypedItem): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) out[k] = typedToPlain(v);
  return out;
}
