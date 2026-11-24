import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/** Shared error payload shape used by every API route. */
export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** 400 response from a failed Zod parse. */
export function validationError(error: ZodError) {
  return errorResponse("ValidationError", error.errors[0]?.message || "Invalid input", 400);
}

/** 400 response for a missing/blank required query parameter. */
export function missingParam(name: string) {
  return errorResponse("ValidationError", `${name} parameter is required`, 400);
}

export class InvalidJsonError extends Error {
  constructor() {
    super("Request body must be valid JSON");
    this.name = "InvalidJsonError";
  }
}

/**
 * Parses a JSON request body. Throws {@link InvalidJsonError} (mapped to a 400
 * by `handleAwsError`) instead of letting a SyntaxError surface as a 500.
 */
export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new InvalidJsonError();
  }
}

/** Parses a bounded integer query param, falling back when absent/NaN. */
export function intParam(
  value: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
