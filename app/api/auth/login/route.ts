import { NextRequest, NextResponse } from "next/server";
import { readAuthConfig } from "@/lib/auth/config";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSession } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// Failed-attempt limiter per client IP (in memory; resets on restart, which is fine for one admin).
const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest): string {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

const fail = (status: number, message: string) => NextResponse.json({ error: { code: "LoginFailed", message } }, { status });

export async function POST(request: NextRequest) {
  const config = readAuthConfig();
  if (config.mode !== "password" || !config.passwordHash || !config.sessionSecret || config.sessionSecret.length < 32) {
    return fail(404, "Password login is not enabled.");
  }
  if (!isSameOriginRequest(request.headers, config.extraOrigins)) return fail(403, "Cross-origin request blocked.");

  const ip = clientIp(request);
  const now = Date.now();
  const entry = failures.get(ip);
  if (entry && entry.resetAt > now && entry.count >= MAX_FAILURES) {
    return fail(429, "Too many failed attempts. Try again in a few minutes.");
  }

  let password = "";
  try {
    const body = await request.json();
    if (typeof body?.password === "string") password = body.password.slice(0, 256);
  } catch {
    return fail(400, "Invalid request.");
  }

  if (!password || !verifyPassword(password, config.passwordHash)) {
    const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + WINDOW_MS };
    failures.set(ip, { count: current.count + 1, resetAt: current.resetAt });
    await new Promise((resolve) => setTimeout(resolve, 400));
    return fail(401, "Wrong password.");
  }

  failures.delete(ip);
  const response = NextResponse.json({ success: true });
  const secure = request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
  response.cookies.set(SESSION_COOKIE, await createSession(config.sessionSecret), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
