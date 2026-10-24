# Aakash (आकाश) — Modern Local AWS Cloud & Developer Console

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Docker Engine](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15.1.0-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![AWS SDK v3](https://img.shields.io/badge/AWS%20SDK-v3-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/sdk-for-javascript/)
[![Vitest](https://img.shields.io/badge/Tests-55%2F55%20Passing-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

**A complete, production-grade local AWS cloud emulator and high-fidelity management console.**  
Develop, test, and debug multi-service cloud architectures locally with zero AWS bills, full network isolation, and sub-millisecond API execution.

[Quick Start](#-quick-start-one-liner) • [Features](#-supported-aws-services) • [One-Line Install](#-one-line-installer) • [Uninstall](#-one-line-uninstaller) • [CLI & SDK Configuration](#-aws-cli--sdk-configuration) • [Deep Testing](#-automated-deep-testing)

</div>

---

## ⚡ Quick Start (One-Liner)

You do **not** need to manually clone this repository. Run this single command in your terminal to automatically bootstrap and launch the entire stack:

### Linux / macOS
```bash
curl -fsSL https://raw.githubusercontent.com/prathamrajbhar/aakash-system/main/install.sh | bash
```

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/prathamrajbhar/aakash-system/main/install.ps1 | iex
```

Once installed, your local cloud and management interface are immediately accessible:
- **Cloud Management Console UI**: [http://localhost:3050](http://localhost:3050)
- **Unified AWS API Endpoint**: `http://localhost:4566`
- **Region**: `us-east-1` (or your configured region)
- **Access / Secret Keys**: Any placeholder string (e.g., `test` / `test`)

---

## 🗑️ One-Line Uninstaller

To completely stop and purge all Aakash containers, networks, and persistent data volumes:

### Linux / macOS
```bash
curl -fsSL https://raw.githubusercontent.com/prathamrajbhar/aakash-system/main/uninstall.sh | bash -s -- --all
```

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/prathamrajbhar/aakash-system/main/uninstall.ps1 | iex
```

---

## 🌟 Supported AWS Services

Aakash provides first-class API coverage and interactive visual management for **10 core AWS services**:

| Service | Emulated Capabilities | Dashboard Tooling |
| :--- | :--- | :--- |
| **Amazon S3** | Buckets, multi-part uploads, binary storage, metadata, object downloads | Interactive file explorer, drag-and-drop uploads, signed URL generator |
| **Amazon DynamoDB** | Composite keys (HASH + RANGE), attributes (S, N, M, L, BOOL), queries, updates | DynamoDB Studio, JSON item editor, filter/expression query runner |
| **AWS Lambda** | Containerized on-demand runtimes (Node.js, Python), zip deployments | Live function invocation runner with custom JSON event payloads |
| **Amazon SQS & SNS** | Standard queues, FIFO queues, topics, subscriptions, fan-out delivery | Message publisher, real-time message viewer, dead-letter monitoring |
| **Amazon SES** | Identity verification, transactional sending, attachment handling | Local intercepted email inbox with HTML/Text rendering & MIME viewer |
| **SSM Parameter Store**| Hierarchical `/app/prod/` parameters, `String`, `StringList`, `SecureString` | Centralized parameter editor with instant decryption viewer |
| **AWS Secrets Manager**| JSON key-value secret vaults, encrypted secrets, on-demand rotation | Secure credentials manager with reveal/hide masking and JSON validator |
| **CloudWatch Logs** | Log groups, log streams, event ingestion, timestamp sequencing | Real-time live log tailer with keyword pattern filtering |
| **Amazon EC2** | VM instance state simulation (Run, Stop, Reboot, Terminate), security groups | Instance lifecycle manager with state indicators and proxy SSH hints |
| **Amazon RDS** | PostgreSQL, MySQL, MariaDB emulation with pgvector support | One-click port reachability tester & connection string generator |
| **Amazon ElastiCache**| Redis / Valkey standalone and cluster emulation | Node status diagnostics and client connection string builder |

---

## 🏗️ Architecture

```
                                  USER BROWSER / CLIENT
                                            │
                             ┌──────────────┴──────────────┐
                             │                             │
                     Port 3050 (HTTP)              Port 4566 (AWS API)
                             │                             │
                             ▼                             ▼
                 ┌───────────────────────┐     ┌───────────────────────┐
                 │   Aakash Console UI   │     │  Aakash AWS Emulator  │
                 │   (Next.js 15 Stand-  │────▶│    (Port 4566 Core)   │
                 │   alone Docker App)   │     └───────────┬───────────┘
                 └───────────────────────┘                 │
                             │                             │  Docker Socket
                             ▼                             ▼
                 ┌───────────────────────┐     ┌───────────────────────┐
                 │ ./aakash-dashboard-   │     │ Containerized Workers │
                 │ data (NAT & Settings) │     │ (Postgres, Redis,     │
                 └───────────────────────┘     │  Node Lambda runtimes)│
                                               └───────────────────────┘
```

- **Unified Gateway**: All AWS SDKs and CLI commands target a single port (`4566`).
- **Zero Configuration**: No cloud accounts, credit cards, or external network connectivity required.
- **NAT & Host Rewriting**: Intelligent Docker container IP translation prevents leaked internal bridge IPs when connecting external host clients.

---

## 🛠️ AWS CLI & SDK Configuration

Target Aakash directly from your terminal or application code:

### 1. AWS CLI
```bash
# Configure standard dummy credentials
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"
export AWS_DEFAULT_REGION="us-east-1"

# Query S3
aws --endpoint-url=http://localhost:4566 s3 ls

# Query DynamoDB
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# Query SSM
aws --endpoint-url=http://localhost:4566 ssm get-parameters-by-path --path "/app" --recursive --with-decryption
```

### 2. Node.js (AWS SDK v3)
```typescript
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  forcePathStyle: true,
});

const { Buckets } = await s3.send(new ListBucketsCommand({}));
console.log(Buckets);
```

### 3. Python (Boto3)
```python
import boto3

s3 = boto3.client(
    "s3",
    endpoint_url="http://localhost:4566",
    region_name="us-east-1",
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

response = s3.list_buckets()
print(response["Buckets"])
```

---

## 💻 Manual Setup & Repository Workflow

If you prefer to clone and contribute to the source code:

### Prerequisites
- [Docker Engine](https://docs.docker.com/engine/install/) (v24.0+) & Docker Compose
- [Node.js](https://nodejs.org/) (v20.0+ LTS)

### Clone & Start
```bash
# Clone the repository
git clone https://github.com/prathamrajbhar/aakash-system.git
cd aakash-system

# Run the installer script
./install.sh

# Or launch directly with Docker Compose
docker compose up -d --build
```

### Management Commands
```bash
./install.sh --status    # Check status of all containers & ports
./install.sh --logs      # Stream real-time container logs
./install.sh --stop      # Stop all running containers
./install.sh --restart   # Restart containers
./install.sh --dev       # Start local Next.js dev server on http://localhost:3050
./install.sh --verify    # Run TypeScript check, linter, and full test suite
```

---

## 🧪 Automated Deep Testing

Aakash includes an exhaustive, operational testing suite that tests real end-to-end cloud operations (not shallow mocks):

```bash
# Run the 36-step live operations test against the running emulator
node ./tests/deep-service-test.mjs

# Run Vitest unit & API integration test suites
npm run test
```

### Test Operations Coverage
- **S3**: Bucket creation, binary object upload, checksum verification, prefix listing, and deletion.
- **DynamoDB**: Composite HASH + RANGE table creation, nested JSON item persistence, query with KeyConditionExpression, UpdateItem expressions, and cleanup.
- **SQS & SNS**: Topic creation, queue subscription, fan-out event publication, message polling, and envelope verification.
- **SES**: Email identity verification, transactional message dispatch, and local inbox interception.
- **SSM & Secrets Manager**: Hierarchical SecureString encryption, decrypted path queries, and secret key rotation.
- **CloudWatch Logs**: Group and stream provisioning, log event ingestion, and keyword pattern search.
- **Lambda**: On-demand zip bundle compilation, container execution, and mathematical payload computation.
- **EC2 & RDS**: Instance state tracking and database proxy port connectivity diagnostics.

---

## 🔒 Security & Persistence

- **Data Persistence**: State is stored in `./aakash-data` and `./aakash-dashboard-data`. Your queues, tables, and buckets survive container restarts.
- **Local Isolation**: All emulated resources remain strictly on your machine. No telemetry or credentials leave your environment.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
