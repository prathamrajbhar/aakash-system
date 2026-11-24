import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { getS3Client } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { errorResponse, missingParam } from "@/lib/api/server";
import { contentDisposition } from "@/lib/http";
import { getMimeType } from "@/lib/mime-types";
import { GetObjectCommand } from "@aws-sdk/client-s3";

interface RouteParams {
  params: Promise<{ bucket: string }>;
}

/** Content types a browser would execute if served from the dashboard origin. */
const ACTIVE_CONTENT = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|(text|application)\/javascript)\b/i;

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { bucket } = await params;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const isInline = searchParams.get("inline") === "true";

    if (!key) {
      return missingParam("Object key");
    }

    const s3 = getS3Client();
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

    if (!response.Body) {
      return errorResponse("NoSuchKey", "Object body is empty", 404);
    }

    const filename = key.split("/").pop() || key;
    const contentType = getMimeType(filename, response.ContentType);

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition(isInline ? "inline" : "attachment", filename),
      // Objects are mutable; never let the browser show a stale copy.
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    };
    if (response.ContentLength !== undefined) {
      headers["Content-Length"] = String(response.ContentLength);
    }
    if (response.ETag) headers.ETag = response.ETag;
    // Uploaded HTML/SVG/JS would otherwise run with the dashboard's origin.
    if (isInline && ACTIVE_CONTENT.test(contentType)) {
      headers["Content-Security-Policy"] = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";
    }

    // Stream instead of buffering the whole object in memory.
    const nodeStream = response.Body as unknown as Readable;
    const stream =
      typeof nodeStream.pipe === "function"
        ? (Readable.toWeb(nodeStream) as unknown as ReadableStream)
        : (response.Body as unknown as { transformToWebStream(): ReadableStream }).transformToWebStream();

    return new Response(stream, { status: 200, headers });
  } catch (error) {
    return handleAwsError(error, "S3_DOWNLOAD_OBJECT");
  }
}
