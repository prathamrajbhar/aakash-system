/**
 * Browser-side fetch helper for the dashboard's own `/api/*` routes.
 *
 * Every API route answers errors with `{ error: { code, message } }` (see
 * `lib/aws/error-handler.ts`). `apiFetch` turns any non-2xx response into a
 * thrown {@link ApiError} so React Query surfaces it as `error` instead of
 * silently treating the error body as data (which made pages render a
 * misleading "empty" state whenever the backend was down).
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = "ApiError", status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

interface ErrorBody {
  error?: string | { code?: string; message?: string };
  message?: string;
}

export async function parseApiError(res: Response): Promise<ApiError> {
  let body: ErrorBody | null = null;
  try {
    body = (await res.json()) as ErrorBody;
  } catch {
    // Non-JSON error body (proxy error page, etc.)
  }

  if (body && typeof body.error === "object" && body.error) {
    return new ApiError(
      body.error.message || res.statusText || "Request failed",
      body.error.code || "ApiError",
      res.status
    );
  }
  if (body && typeof body.error === "string") {
    return new ApiError(body.error, "ApiError", res.status);
  }
  if (body?.message) {
    return new ApiError(body.message, "ApiError", res.status);
  }
  return new ApiError(
    res.statusText || `Request failed with status ${res.status}`,
    "ApiError",
    res.status
  );
}

export async function apiFetch<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? err.message : "Network request failed",
      "NetworkError",
      0
    );
  }
  if (!res.ok) throw await parseApiError(res);
  return (await res.json()) as T;
}

/** JSON body helper: `apiSend("/api/x", "POST", { a: 1 })`. */
export function apiSend<T = unknown>(
  input: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  return apiFetch<T>(input, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
