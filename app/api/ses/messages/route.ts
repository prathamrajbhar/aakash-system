import { NextResponse } from "next/server";
import { awsConfig } from "@/lib/aws/config";
import { BACKEND_PATHS } from "@/lib/backend-paths";

import { promises as fs } from "fs";

export interface CapturedEmail {
  id: string;
  source: string;
  destination: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  timestamp: string;
}

interface RawSesEmailRecord {
  MessageId?: string;
  Source?: string;
  Destination?: string[];
  Subject?: string;
  BodyText?: string | null;
  BodyHtml?: string | null;
  SentAt?: string;
}

export async function GET() {
  try {
    const inspectionUrl = `${awsConfig.AAKASH_ENDPOINT}${BACKEND_PATHS.sesMessages}`;
    const response = await fetch(inspectionUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const body = await response.json();
      const messages = Array.isArray(body) ? body : body.messages || [];
      return NextResponse.json({ messages, count: messages.length });
    }
  } catch {
    // Fall back to reading storage directory below
  }

  // Fallback: Read persisted SES emails from shared volume
  try {
    const candidatePaths = [
      "/var/lib/floci/ses-emails.json",
      "/app/data/ses-emails.json",
      "./aakash-data/ses-emails.json",
    ];

    for (const filePath of candidatePaths) {
      try {
        const fileContent = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(fileContent) as Record<string, RawSesEmailRecord>;
        const messages: CapturedEmail[] = Object.values(parsed).map((raw) => ({
          id: raw.MessageId || "msg_unknown",
          source: raw.Source || "",
          destination: raw.Destination || [],
          subject: raw.Subject || "",
          bodyText: raw.BodyText || undefined,
          bodyHtml: raw.BodyHtml || undefined,
          timestamp: raw.SentAt || new Date().toISOString(),
        }));
        return NextResponse.json({ messages, count: messages.length });
      } catch {
        // Continue to next candidate path
      }
    }
  } catch {
    // Ignore file fallback error
  }

  return NextResponse.json({ messages: [], count: 0 });
}
