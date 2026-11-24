import { NextRequest, NextResponse } from "next/server";
import { getS3Client } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { readJson, validationError } from "@/lib/api/server";
import { createBucketSchema, deleteBucketSchema } from "@/lib/validations/s3";
import {
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  paginateListObjectsV2,
  type S3Client,
} from "@aws-sdk/client-s3";

/** Deletes every object in a bucket (S3 refuses to delete non-empty buckets). */
async function emptyBucket(s3: S3Client, bucket: string): Promise<number> {
  let deleted = 0;
  for await (const page of paginateListObjectsV2({ client: s3 }, { Bucket: bucket })) {
    const objects = (page.Contents || []).map((o) => ({ Key: o.Key as string }));
    if (objects.length === 0) continue;
    const res = await s3.send(
      new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects, Quiet: true } })
    );
    if (res.Errors?.length) {
      throw new Error(`Failed to delete ${res.Errors.length} object(s): ${res.Errors[0].Message}`);
    }
    deleted += objects.length;
  }
  return deleted;
}

export async function GET() {
  try {
    const s3 = getS3Client();
    const command = new ListBucketsCommand({});
    const response = await s3.send(command);

    const buckets = (response.Buckets || []).map((bucket) => ({
      name: bucket.Name || "",
      creationDate: bucket.CreationDate,
    }));

    return NextResponse.json({ buckets, count: buckets.length });
  } catch (error) {
    return handleAwsError(error, "S3_LIST_BUCKETS");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const validation = createBucketSchema.safeParse(body);

    if (!validation.success) {
      return validationError(validation.error);
    }

    const s3 = getS3Client();
    const command = new CreateBucketCommand({
      Bucket: validation.data.bucketName,
    });
    await s3.send(command);

    return NextResponse.json({
      success: true,
      bucket: {
        name: validation.data.bucketName,
        creationDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleAwsError(error, "S3_CREATE_BUCKET");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await readJson(request);
    const validation = deleteBucketSchema.safeParse(body);

    if (!validation.success) {
      return validationError(validation.error);
    }

    const s3 = getS3Client();
    if (validation.data.force) {
      await emptyBucket(s3, validation.data.bucketName);
    }
    const command = new DeleteBucketCommand({
      Bucket: validation.data.bucketName,
    });
    await s3.send(command);

    return NextResponse.json({
      success: true,
      message: `Bucket ${validation.data.bucketName} deleted successfully`,
    });
  } catch (error) {
    return handleAwsError(error, "S3_DELETE_BUCKET");
  }
}
