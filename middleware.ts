import { NextResponse, type NextRequest } from "next/server";
import { authorizeRequest } from "@/lib/auth/access";
import { readAuthConfig } from "@/lib/auth/config";

/** Header that carries the verified user's email to server components. */
const USER_HEADER = "x-aakash-user";

export async function middleware(request: NextRequest) {
  const result = await authorizeRequest(request, readAuthConfig());

  if (!result.ok) {
    if (result.code === "LoginRequired" && !request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: result.code, message: result.message } },
        { status: result.status }
      );
    }
    return new NextResponse(result.message, {
      status: result.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Never trust a client-supplied identity header: always overwrite it.
  const headers = new Headers(request.headers);
  headers.delete(USER_HEADER);
  if (result.email) headers.set(USER_HEADER, result.email);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Static bundles, the liveness probe and the login endpoints stay reachable without a token.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/healthz|api/auth/login|login).*)"],
};
