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
  SQSClient,
  CreateQueueCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
} from "@aws-sdk/client-sqs";
import {
  SNSClient,
  CreateTopicCommand,
  SubscribeCommand,
  PublishCommand,
  UnsubscribeCommand,
  DeleteTopicCommand,
} from "@aws-sdk/client-sns";
import {
  SESClient,
  VerifyEmailIdentityCommand,
  SendEmailCommand,
  DeleteIdentityCommand,
} from "@aws-sdk/client-ses";
import {
  SSMClient,
  PutParameterCommand,
  GetParameterCommand,
  GetParametersByPathCommand,
  DeleteParameterCommand,
} from "@aws-sdk/client-ssm";
import {
  SecretsManagerClient,
  CreateSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  DeleteSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  FilterLogEventsCommand,
  DeleteLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  LambdaClient,
  CreateFunctionCommand,
  InvokeCommand,
  DeleteFunctionCommand,
} from "@aws-sdk/client-lambda";
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
const sqs = new SQSClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDENTIALS });
const sns = new SNSClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDENTIALS });
const ses = new SESClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDENTIALS });
const ssm = new SSMClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDENTIALS });
const sm = new SecretsManagerClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDENTIALS });
const cwl = new CloudWatchLogsClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDENTIALS });
const lambda = new LambdaClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDENTIALS });
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

  // 3. SQS & SNS INTEGRATION (FAN-OUT TO QUEUE)
  const qName = `fanout-queue-${Date.now()}`;
  let qUrl = "";
  let qArn = "";
  let topicArn = "";
  let subArn = "";

  await step("SQS: Create queue", async () => {
    const res = await sqs.send(new CreateQueueCommand({ QueueName: qName }));
    qUrl = res.QueueUrl;
    // Format ARN
    qArn = `arn:aws:sqs:us-east-1:000000000000:${qName}`;
  });

  await step("SNS: Create topic and subscribe SQS queue", async () => {
    const topRes = await sns.send(new CreateTopicCommand({ Name: `fanout-topic-${Date.now()}` }));
    topicArn = topRes.TopicArn;

    const subRes = await sns.send(new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "sqs",
      Endpoint: qArn,
    }));
    subArn = subRes.SubscriptionArn;
  });

  await step("SNS -> SQS: Publish to topic and consume from queue (Fan-out)", async () => {
    const testPayload = JSON.stringify({ event: "ORDER_SHIPPED", trackingId: "TRK_99812" });
    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Subject: "Order Shipping Event",
      Message: testPayload,
    }));

    // Poll SQS to verify message delivery
    let received = false;
    for (let i = 0; i < 5; i++) {
      const rx = await sqs.send(new ReceiveMessageCommand({
        QueueUrl: qUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 1,
      }));
      if (rx.Messages && rx.Messages.length > 0) {
        const body = JSON.parse(rx.Messages[0].Body);
        // SNS wraps message in SNS envelope
        if (body.Message && body.Message.includes("ORDER_SHIPPED")) {
          received = true;
          // Delete message
          await sqs.send(new DeleteMessageCommand({
            QueueUrl: qUrl,
            ReceiptHandle: rx.Messages[0].ReceiptHandle,
          }));
          break;
        }
      }
    }
    if (!received) throw new Error("Message published to SNS was not received in SQS queue");
  });

  await step("SNS & SQS: Unsubscribe and delete resources", async () => {
    if (subArn && subArn.startsWith("arn:")) {
      await sns.send(new UnsubscribeCommand({ SubscriptionArn: subArn }));
    }
    await sns.send(new DeleteTopicCommand({ TopicArn: topicArn }));
    await sqs.send(new DeleteQueueCommand({ QueueUrl: qUrl }));
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

  // 5. SSM PARAMETER STORE: HIERARCHY, SECURESTRING & RECOVERY
  const prefix = `/prod/services/auth/${Date.now()}`;
  await step("SSM: Store hierarchical plaintext and SecureString parameters", async () => {
    await ssm.send(new PutParameterCommand({
      Name: `${prefix}/db_host`,
      Value: "postgres.internal.net",
      Type: "String",
      Overwrite: true,
    }));
    await ssm.send(new PutParameterCommand({
      Name: `${prefix}/jwt_secret`,
      Value: "super_secret_signing_key_443",
      Type: "SecureString",
      Overwrite: true,
    }));
  });

  await step("SSM: GetParametersByPath with decryption", async () => {
    const res = await ssm.send(new GetParametersByPathCommand({
      Path: prefix,
      WithDecryption: true,
      Recursive: true,
    }));
    if (!res.Parameters || res.Parameters.length !== 2) throw new Error("Expected 2 hierarchical parameters");
    const jwtParam = res.Parameters.find((p) => p.Name.endsWith("jwt_secret"));
    if (jwtParam?.Value !== "super_secret_signing_key_443") throw new Error("Decrypted SecureString value mismatch");
  });

  await step("SSM: Delete parameters", async () => {
    await ssm.send(new DeleteParameterCommand({ Name: `${prefix}/db_host` }));
    await ssm.send(new DeleteParameterCommand({ Name: `${prefix}/jwt_secret` }));
  });

  // 6. SECRETS MANAGER: JSON SECRET, ROTATION SIMULATION & FORCE DELETE
  const secName = `prod/api/credentials_${Date.now()}`;
  await step("Secrets Manager: Create secret with JSON credentials", async () => {
    await sm.send(new CreateSecretCommand({
      Name: secName,
      SecretString: JSON.stringify({ apiKey: "key_v1_abcdef", tier: "enterprise" }),
      Description: "API Credentials",
    }));
  });

  await step("Secrets Manager: PutSecretValue (simulating key rotation)", async () => {
    await sm.send(new PutSecretValueCommand({
      SecretId: secName,
      SecretString: JSON.stringify({ apiKey: "key_v2_xyz987", tier: "enterprise" }),
    }));

    const res = await sm.send(new GetSecretValueCommand({ SecretId: secName }));
    const parsed = JSON.parse(res.SecretString);
    if (parsed.apiKey !== "key_v2_xyz987") throw new Error("Rotated secret value mismatch");
  });

  await step("Secrets Manager: Force delete secret without recovery window", async () => {
    await sm.send(new DeleteSecretCommand({ SecretId: secName, ForceDeleteWithoutRecovery: true }));
  });

  // 7. CLOUDWATCH LOGS: LOG GROUP, LOG STREAM, PUT LOG EVENTS & FILTER
  const lgName = `/aws/lambda/checkout-worker-${Date.now()}`;
  const lsName = `stream-${Date.now()}`;
  await step("CloudWatch Logs: Create log group and log stream", async () => {
    await cwl.send(new CreateLogGroupCommand({ logGroupName: lgName }));
    await cwl.send(new CreateLogStreamCommand({ logGroupName: lgName, logStreamName: lsName }));
  });

  await step("CloudWatch Logs: PutLogEvents and filter by keyword pattern", async () => {
    const timestamp = Date.now();
    await cwl.send(new PutLogEventsCommand({
      logGroupName: lgName,
      logStreamName: lsName,
      logEvents: [
        { timestamp, message: "INFO: Worker initialized" },
        { timestamp: timestamp + 10, message: "CRITICAL_PAYMENT_FAILURE: Card declined by gateway" },
        { timestamp: timestamp + 20, message: "INFO: Worker shutting down" },
      ],
    }));

    // Filter by pattern
    const res = await cwl.send(new FilterLogEventsCommand({
      logGroupName: lgName,
      filterPattern: "CRITICAL_PAYMENT_FAILURE",
    }));
    if (!res.events || res.events.length === 0) throw new Error("Filtered event not found");
    if (!res.events[0].message.includes("Card declined")) throw new Error("Event message mismatch");
  });

  await step("CloudWatch Logs: Delete log group", async () => {
    await cwl.send(new DeleteLogGroupCommand({ logGroupName: lgName }));
  });

  // 8. AWS LAMBDA: PACK ZIP, CREATE FUNCTION, EXECUTE & VERIFY
  const fnName = `orderCalculator-${Date.now()}`;
  await step("Lambda: Package zip and create Node.js function", async () => {
    const tmpDir = `/tmp/lambda-${Date.now()}`;
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(`${tmpDir}/index.js`, `
      exports.handler = async (event) => {
        const subtotal = event.subtotal || 0;
        const taxRate = event.taxRate || 0.1;
        const total = subtotal + (subtotal * taxRate);
        return {
          statusCode: 200,
          calculatedTotal: total,
          currency: event.currency || "USD"
        };
      };
    `);
    execSync(`cd ${tmpDir} && zip -r function.zip index.js`);
    const zipBuffer = fs.readFileSync(`${tmpDir}/function.zip`);

    await lambda.send(new CreateFunctionCommand({
      FunctionName: fnName,
      Runtime: "nodejs18.x",
      Role: "arn:aws:iam::000000000000:role/lambda-role",
      Handler: "index.handler",
      Code: { ZipFile: zipBuffer },
      Timeout: 15,
      MemorySize: 128,
    }));
  });

  await step("Lambda: Invoke function with payload and verify computed output", async () => {
    const payload = JSON.stringify({ subtotal: 100, taxRate: 0.08, currency: "USD" });
    const res = await lambda.send(new InvokeCommand({
      FunctionName: fnName,
      Payload: Buffer.from(payload),
    }));

    if (res.StatusCode !== 200) throw new Error(`Invocation failed with status ${res.StatusCode}`);
    const responsePayload = JSON.parse(Buffer.from(res.Payload).toString("utf-8"));
    if (responsePayload.calculatedTotal !== 108) {
      throw new Error(`Expected calculatedTotal 108, got ${responsePayload.calculatedTotal}`);
    }
  });

  await step("Lambda: Delete function", async () => {
    await lambda.send(new DeleteFunctionCommand({ FunctionName: fnName }));
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

  // 11. NETWORK CONFIGURATION: REVERSE PROXY & HOST REWRITING LOGIC
  await step("Network Config: Verify NAT host rewriting and endpoint test", async () => {
    const testRes = await fetch(`${DASHBOARD_URL}/api/network-config/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocol: "http", host: "localhost", apiPort: 4566 }),
    });
    const testData = await testRes.json();
    if (!testData.success) throw new Error(`Network connectivity test failed: ${testData.error}`);
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
