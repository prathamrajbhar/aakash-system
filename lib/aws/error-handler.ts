import { NextResponse } from "next/server";
import { logger } from "../logger";
import { InvalidJsonError } from "../api/server";

export interface StandardApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

type ErrorWithCause = Error & {
  code?: string;
  cause?: unknown;
  errors?: unknown[];
};

/**
 * True when the error means "could not talk to the emulator at all" (as opposed
 * to the emulator answering with an error). Looks through `cause` chains and
 * `AggregateError`s, which Node emits for dual-stack `localhost` lookups.
 */
export function isConnectionError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 4) return false;
  const err = error as ErrorWithCause;

  if (typeof err.code === "string" && CONNECTION_ERROR_CODES.has(err.code)) return true;
  if (err.name === "TimeoutError" || err.name === "AbortError") return true;
  if (Array.isArray(err.errors) && err.errors.some((e) => isConnectionError(e, depth + 1))) {
    return true;
  }
  return isConnectionError(err.cause, depth + 1);
}

const CONNECTION_MESSAGE =
  "Could not reach the Aakash emulator. Check that the emulator container is running and that AAKASH_ENDPOINT is correct.";

export function handleAwsError(error: unknown, context: string = "AWS_OPERATION"): NextResponse<StandardApiError> {
  const log = logger.child({ context });

  if (error instanceof InvalidJsonError) {
    return NextResponse.json(
      { error: { code: "ValidationError", message: error.message } },
      { status: 400 }
    );
  }

  if (isConnectionError(error)) {
    log.error({ err: error }, `Emulator unreachable in ${context}`);
    return NextResponse.json(
      { error: { code: "EmulatorUnreachable", message: CONNECTION_MESSAGE } },
      { status: 503 }
    );
  }

  if (error instanceof Error) {
    const errorName = (error as { name?: string }).name || "UnknownError";
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode || 500;
    const errorMessage = error.message || "An unexpected error occurred.";

    log.error({ err: error, name: errorName, statusCode }, `Error in ${context}: ${errorMessage}`);

    // Map common AWS errors to standard HTTP status codes if not explicitly set
    let finalStatus = statusCode;
    if (finalStatus === 500) {
      if (
        errorName.includes("NotFound") ||
        errorName.includes("NoSuchBucket") ||
        errorName.includes("NoSuchKey") ||
        errorName.includes("ResourceNotFound")
      ) {
        finalStatus = 404;
      } else if (
        errorName.includes("AlreadyExists") ||
        errorName.includes("BucketAlreadyExists") ||
        errorName.includes("Duplicate")
      ) {
        finalStatus = 409;
      } else if (
        errorName.includes("InvalidParameter") ||
        errorName.includes("ValidationException")
      ) {
        finalStatus = 400;
      }
    }

    return NextResponse.json(
      {
        error: {
          code: errorName,
          message: errorMessage,
        },
      },
      { status: finalStatus }
    );
  }

  log.error({ err: error }, `Non-standard error encountered in ${context}`);

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: String(error) || "An unexpected error occurred.",
      },
    },
    { status: 500 }
  );
}
