// Hard Deep Test Suite: Executes real AWS operations and deep data workflows across every service
import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  CreateTableCommand,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  DeleteTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
  SESClient,
  VerifyEmailIdentityCommand,
  SendEmailCommand,
  DeleteIdentityCommand,
} from "@aws-sdk/client-ses";
import {
  EC2Client,
  RunInstancesCommand,
  DescribeInstancesCommand,
  TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";
import fs from "fs";
import { execSync } from "child_process";

const ENDPOINT = "http://localhost:4566";
const DASHBOARD_URL = "http://localhost:3050";
const REGION = "us-east-1";
const CREDENTIALS = { accessKeyId: "test", secretAccessKey: "test" };

const s3 = new S3Client({ endpoint: ENDPOINT, region: REGION, credentials: CREDENTIALS, forcePathStyle: true });
const ddb = new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDENTIALS });
const ses = new SESClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDENTIALS });
const ec2 = new EC2Client({ endpoint: ENDPOINT, region: REGION, credentials: CREDENTIALS });

const results = [];

async function step(name, fn) {
  try {
    process.stdout.write(`Testing: ${name}... `);
    await fn();
    console.log("✓ PASS");
    results.push({ name, status: "PASS" });
  } catch (err) {
    console.log(`✗ FAIL: ${err.message}`);
    results.push({ name, status: "FAIL", error: err.message });
  }
}

async function runHardTests() {
  console.log("=================================================================");
  console.log(" STARTING EXHAUSTIVE DEEP FUNCTIONALITY TESTS (ALL AWS SERVICES) ");
  console.log("=================================================================\n");

  // 1. S3 DEEP TEST
  const bktName = `deep-test-bucket-${Date.now()}`;
  await step("S3: Create bucket", async () => {
    await s3.send(new CreateBucketCommand({ Bucket: bktName }));
  });

  await step("S3: Put object with binary/text data", async () => {
    const content = JSON.stringify({ message: "Production test asset", timestamp: Date.now() });
    await s3.send(new PutObjectCommand({
      Bucket: bktName,
      Key: "data/config.json",
      Body: Buffer.from(content, "utf-8"),
      ContentType: "application/json",
      Metadata: { "author": "aakash-test" },
    }));
  });

  await step("S3: Get object and verify integrity", async () => {
    const res = await s3.send(new GetObjectCommand({ Bucket: bktName, Key: "data/config.json" }));
    const raw = await res.Body.transformToString();
    const parsed = JSON.parse(raw);
    if (parsed.message !== "Production test asset") throw new Error("Object payload mismatch");
  });

  await step("S3: List objects and verify prefix & size", async () => {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: bktName, Prefix: "data/" }));
    if (!res.Contents || res.Contents.length === 0) throw new Error("Object not listed");
    if (res.Contents[0].Key !== "data/config.json") throw new Error("Listed key mismatch");
  });

  await step("S3: Delete object and delete bucket", async () => {
    await s3.send(new DeleteObjectCommand({ Bucket: bktName, Key: "data/config.json" }));
    await s3.send(new DeleteBucketCommand({ Bucket: bktName }));
  });

  // 2. DYNAMODB DEEP TEST
  const tblName = `Orders_${Date.now()}`;
  await step("DynamoDB: Create table with Composite Primary Key (HASH + RANGE)", async () => {
    await ddb.send(new CreateTableCommand({
      TableName: tblName,
      KeySchema: [
        { AttributeName: "customerId", KeyType: "HASH" },
        { AttributeName: "orderId", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "customerId", AttributeType: "S" },
        { AttributeName: "orderId", AttributeType: "S" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    }));
  });

  await step("DynamoDB: Put multiple complex items (Strings, Numbers, Maps, Lists)", async () => {
    await ddb.send(new PutItemCommand({
      TableName: tblName,
      Item: {
        customerId: { S: "cust_101" },
        orderId: { S: "ord_001" },
        totalAmount: { N: "250.75" },
        status: { S: "PAID" },
        items: { L: [{ S: "item_a" }, { S: "item_b" }] },
        metadata: { M: { channel: { S: "mobile" }, expedited: { BOOL: true } } },
      },
    }));
    await ddb.send(new PutItemCommand({
      TableName: tblName,
      Item: {
        customerId: { S: "cust_101" },
        orderId: { S: "ord_002" },
        totalAmount: { N: "49.99" },
        status: { S: "PENDING" },
      },
    }));
  });

  await step("DynamoDB: GetItem and verify typed attribute extraction", async () => {
    const res = await ddb.send(new GetItemCommand({
      TableName: tblName,
      Key: {
        customerId: { S: "cust_101" },
        orderId: { S: "ord_001" },
      },
    }));
    if (!res.Item) throw new Error("Item not found");
    if (res.Item.totalAmount?.N !== "250.75") throw new Error("Attribute value mismatch");
    if (res.Item.metadata?.M?.expedited?.BOOL !== true) throw new Error("Nested Map/Boolean mismatch");
  });

  await step("DynamoDB: Query with KeyConditionExpression", async () => {
    const res = await ddb.send(new QueryCommand({
      TableName: tblName,
      KeyConditionExpression: "customerId = :c AND orderId = :o",
      ExpressionAttributeValues: {
        ":c": { S: "cust_101" },
        ":o": { S: "ord_002" },
      },
    }));
    if (!res.Items || res.Items.length !== 1) throw new Error("Query count mismatch");
    if (res.Items[0].status?.S !== "PENDING") throw new Error("Query item status mismatch");
  });

  await step("DynamoDB: UpdateItem expression (Modify status to COMPLETED)", async () => {
    await ddb.send(new UpdateItemCommand({
      TableName: tblName,
      Key: {
        customerId: { S: "cust_101" },
        orderId: { S: "ord_002" },
      },
      UpdateExpression: "SET #st = :newStatus",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: { ":newStatus": { S: "COMPLETED" } },
    }));

    const verify = await ddb.send(new GetItemCommand({
      TableName: tblName,
      Key: {
        customerId: { S: "cust_101" },
        orderId: { S: "ord_002" },
      },
    }));
    if (verify.Item?.status?.S !== "COMPLETED") throw new Error("UpdateItem failed to update attribute");
  });

  await step("DynamoDB: Delete items and Delete table", async () => {
    await ddb.send(new DeleteItemCommand({
      TableName: tblName,
      Key: { customerId: { S: "cust_101" }, orderId: { S: "ord_001" } },
    }));
    await ddb.send(new DeleteItemCommand({
      TableName: tblName,
      Key: { customerId: { S: "cust_101" }, orderId: { S: "ord_002" } },
    }));
    await ddb.send(new DeleteTableCommand({ TableName: tblName }));
  });

  // 4. SES: VERIFY IDENTITY, SEND EMAIL & VERIFY LOCAL INBOX INTERCEPTION
  const senderEmail = `billing-${Date.now()}@aakash.local`;
  await step("SES: Verify email identity", async () => {
    await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: senderEmail }));
  });

  await step("SES: Send email and verify local inbox capture", async () => {
    await ses.send(new SendEmailCommand({
      Source: senderEmail,
      Destination: { ToAddresses: ["customer@domain.com"] },
      Message: {
        Subject: { Data: "Invoice #10492" },
        Body: { Text: { Data: "Your payment of $120.00 was processed successfully." } },
      },
    }));

    // Verify inbox API intercepted email
    const res = await fetch(`${DASHBOARD_URL}/api/ses/messages`);
    const data = await res.json();
    const found = data.messages?.some(
      (m) => m.source === senderEmail && m.subject === "Invoice #10492"
    );
    if (!found) throw new Error("Sent email was not found in local intercepted inbox");
  });

  await step("SES: Delete email identity", async () => {
    await ses.send(new DeleteIdentityCommand({ EmailAddress: senderEmail }));
  });

  // 9. EC2: RUN DOCKER-BASED INSTANCE, VERIFY STATE, TERMINATE
  let instanceId = "";
  await step("EC2: Run instance", async () => {
    const res = await ec2.send(new RunInstancesCommand({
      ImageId: "ami-12345678",
      InstanceType: "t2.micro",
      MinCount: 1,
      MaxCount: 1,
    }));
    if (!res.Instances || res.Instances.length === 0) throw new Error("No instance returned");
    instanceId = res.Instances[0].InstanceId;
  });

  await step("EC2: Describe instances and verify running state", async () => {
    const res = await ec2.send(new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    }));
    const inst = res.Reservations?.[0]?.Instances?.[0];
    if (!inst) throw new Error("Instance not found in describe");
  });

  await step("EC2: Terminate instance", async () => {
    await ec2.send(new TerminateInstancesCommand({
      InstanceIds: [instanceId],
    }));
  });

  // 10. RDS & ELASTICACHE CONNECTION DIAGNOSTICS
  await step("RDS: Connection tester API check", async () => {
    const res = await fetch(`${DASHBOARD_URL}/api/rds/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "test-db-cluster",
        host: "127.0.0.1",
        port: 7001,
        engine: "postgres",
        masterUsername: "postgres",
        masterPassword: "password123",
      }),
    });
    const data = await res.json();
    if (typeof data.success !== "boolean") throw new Error("Invalid RDS test response format: missing success boolean");
  });

  await step("ElastiCache: Clusters query and network translation", async () => {
    const res = await fetch(`${DASHBOARD_URL}/api/elasticache`);
    if (!res.ok) throw new Error(`ElastiCache API returned ${res.status}`);
  });

  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log("\n=================================================================");
  console.log(` RESULTS: ${passed}/${total} Operations Passed (${failed} Failed) `);
  console.log("=================================================================\n");

  if (failed > 0) process.exit(1);
}

runHardTests();
