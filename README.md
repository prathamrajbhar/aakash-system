# Aakash Management Dashboard

A production-grade, fully typed Next.js dashboard for managing local and remote **Aakash** AWS emulator instances. Configure how clients connect from the UI — Local machine, LAN/Wi-Fi, Tailscale VPN, or a custom reverse proxy — with automatic connection-string generation and zero internal Docker IP leaks.

Everything is a typed API route backed by the AWS SDK v3. No raw AWS CLI required.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Installer options](#installer-options)
- [Manual installation](#manual-installation)
- [Environment variables](#environment-variables)
- [Network access modes](#network-access-modes)
- [Running the app](#running-the-app)
- [Project structure](#project-structure)
- [npm scripts](#npm-scripts)
- [API routes](#api-routes)
- [Testing and quality](#testing-and-quality)
- [Troubleshooting](#troubleshooting)
- [Security notes](#security-notes)
- [Backend compatibility](#backend-compatibility)

---

## Features

| Area | Capabilities |
| :--- | :--- |
| **Dashboard** | Live backend health, resource counts, network diagnostics, full state reset |
| **S3** | List, create and delete buckets; upload, download and delete objects; copy S3 URIs |
| **RDS** | Create and delete PostgreSQL / MySQL / MariaDB instances; copy-ready `psql` / `mysql` commands |
| **EC2** | Launch, start, stop and terminate instances; published SSH proxy commands |
| **ElastiCache** | Create and delete Redis / Valkey clusters; `redis-cli` commands |
| **Lambda** | Create, invoke and delete functions with JSON payloads |
| **Messaging** | Manage SQS queues and SNS topics; send and poll test messages |
| **SES** | Verify identities, send test email and inspect captured mail |
| **Network** | Four access modes, auto-detected LAN/Tailscale IPs, live command preview |

---

## Architecture

```
┌──────────────────────────────┐
│  Browser (React 19 + RQ)     │
│  app/* pages                  │
└──────────────┬───────────────┘
               │ fetch
┌──────────────▼───────────────┐
│  Next.js Route Handlers       │
│  app/api/**/route.ts          │
│  Zod validation + errors      │
└──────────────┬───────────────┘
               │ AWS SDK v3
┌──────────────▼───────────────┐
│  Aakash emulator engine       │
│  AAKASH_ENDPOINT (default     │
│  http://localhost:4566)       │
└──────────────────────────────┘
```

- **Reads** use TanStack Query with polling and cache invalidation.
- **Writes** use mutations with optimistic updates where it matters (EC2 actions, queues).
- **Network settings** are persisted server-side as JSON and shared with the browser through a React context provider.

---

## Prerequisites

| Requirement | Version | Notes |
| :--- | :--- | :--- |
| Node.js | **20+** (22 LTS recommended) | Required for local development and build |
| npm | 10+ | Ships with Node.js |
| Docker | Optional | Required only for the Docker stack |
| Docker Compose | v2 plugin or `docker-compose` | Required only for the Docker stack |
| OS | Linux, macOS, Windows 10/11 | Bash installer for Linux/macOS, PowerShell for Windows |

The dashboard itself does not need a local AWS account. The emulator accepts the default `test` / `test` credentials.

---

## Quick start

### Linux and macOS

```bash
git clone <your-repository-url> aakash-dashboard
cd aakash-dashboard
chmod +x install.sh
./install.sh
```

The installer supports direct local development or Docker Compose:

- **Local Development** — runs `npm run dev` on port 3050
- **Docker Compose** — engine + dashboard in containers (no local Node needed)

Open **http://localhost:3050** after it finishes.

Command options:

```bash
./install.sh             # install & run production Docker stack (default)
./install.sh --status    # check container status and ports
./install.sh --logs      # stream live container logs
./install.sh --stop      # stop running containers
./install.sh --dev       # start local Node.js development server
./install.sh --verify    # run typecheck, lint, and test suite

# Complete uninstallation & cleanup:
./uninstall.sh           # interactive uninstall (stops containers, cleans volumes & caches)
./uninstall.sh --all     # full purge: containers, data, Docker images, and node_modules
./uninstall.sh --keep-data # remove containers & caches but preserve ./aakash-data
```

### Windows

Option A — double-click:

```
install.bat
```

Option B — PowerShell:

```powershell
git clone <your-repository-url> aakash-dashboard
cd aakash-dashboard
powershell -ExecutionPolicy Bypass -File .\install.ps1
npm run start
```

One-step variants:

```powershell
.\install.ps1 -Dev        # install + start the dev server
.\install.ps1 -Start      # install + build + start production
.\install.ps1 -Docker     # build and start engine + dashboard in Docker
.\install.ps1 -Verify     # install + build + typecheck + tests + lint
```

> If PowerShell blocks the script, use the `-ExecutionPolicy Bypass` form shown above, or run `install.bat`.

### Docker (any OS)

```bash
docker compose up -d --build
```

- Dashboard: **http://localhost:3050**
- Engine API: **http://localhost:4566**

To use your own emulator image:

```bash
AAKASH_EMULATOR_IMAGE=your-registry/aakash-engine:latest docker compose up -d --build
```

PowerShell:

```powershell
$env:AAKASH_EMULATOR_IMAGE = "your-registry/aakash-engine:latest"
docker compose up -d --build
```

---

## Installer options

### `install.sh` (Linux / macOS)

| Option | What it does |
| :--- | :--- |
| *(none)*, `--dev` | Install dependencies and start development server |
| `--start` | Install dependencies, build and start production server |
| `--build` | Install dependencies and run production build |
| `--docker` | Build and start the Docker Compose stack |
| `--verify` | Run TypeScript typecheck, linter, and tests |
| `--help` | Show help |

### `install.ps1` / `install.bat` (Windows)

| Option | What it does |
| :--- | :--- |
| *(none)* | Check Node, create `.env.local`, install dependencies, build |
| `-Dev` | Same as above, then start the development server |
| `-Start` | Same as above, then start the production server |
| `-Docker` | Build and start the Docker Compose stack (does not require Node) |
| `-Verify` | Run `typecheck`, `test` and `lint` after installing |
| `-NoBuild` | Install dependencies only |
| `-Help` | Show help |

The PowerShell installer installs Node 22 via `winget` (or Chocolatey) when missing.

---

## Manual installation

Use this if you prefer to control each step.

### 1. Install Node.js

Download the LTS release from **https://nodejs.org/en/download**.

Verify:

```bash
node --version   # must be 20 or newer
npm --version
```

### 2. Install dependencies

```bash
npm ci
```

If you do not have a lockfile or need to update it:

```bash
npm install
```

### 3. Create the environment file

```bash
cp .env.example .env.local        # Linux / macOS
Copy-Item .env.example .env.local  # Windows PowerShell
```

Edit `.env.local` if your engine runs somewhere other than `http://localhost:4566`.

### 4. Build and start

```bash
npm run build
npm run start
```

Open **http://localhost:3050**.

### 5. Or run in development

```bash
npm run dev
```

---

## Environment variables

Copy `.env.example` to `.env.local` and adjust as needed. The installer does this for you.

### Core variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `AAKASH_ENDPOINT` | Server-side connection to the emulator engine | `http://localhost:4566` |
| `AAKASH_NETWORK_MODE` | Initial network mode (`local`, `lan`, `tailscale`, `custom`) | `local` |
| `AAKASH_PUBLIC_HOST` | Initial public/published hostname | `localhost` |
| `AAKASH_PUBLIC_PROTOCOL` | Initial protocol (`http` or `https`) | `http` |
| `AAKASH_API_PORT` | Core engine API port | `4566` |
| `AAKASH_CONFIG_LOCKED` | Lock UI network settings in read-only mode (`true`/`false`) | `false` |
| `AAKASH_CONFIG_STORAGE_PATH` | Server-side JSON persistence path | `./data/aakash-ui-config.json` |
| `AAKASH_RDS_PORT_RANGE_START/END` | RDS proxy ports | `7001` – `7099` |
| `AAKASH_EC2_SSH_PORT_RANGE_START/END` | EC2 SSH proxy ports | `2200` – `2299` |
| `AAKASH_ELASTICACHE_PORT_RANGE_START/END` | ElastiCache Redis proxy ports | `6379` – `6399` |
| `AWS_ACCESS_KEY_ID` | Emulator credential | `test` |
| `AWS_SECRET_ACCESS_KEY` | Emulator secret | `test` |
| `AWS_REGION` | Emulator region | `us-east-1` |

### Backend admin hooks (optional)

These three routes power live health, full state reset and the captured-email inbox. They are configurable so the dashboard can target your own engine build:

| Variable | Purpose | Bundled default |
| :--- | :--- | :--- |
| `AAKASH_BACKEND_HEALTH_PATH` | Live health and version | `/_floci/health` |
| `AAKASH_BACKEND_RESET_PATH` | Full state reset | `/_floci/reset` |
| `AAKASH_BACKEND_SES_MESSAGES_PATH` | Captured SES inbox | `/_floci/ses/messages` |

Leave them unset to use the bundled engine. Set them to your own paths when running a custom Aakash build.

### Docker-only variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `AAKASH_EMULATOR_IMAGE` | Backend engine image | `floci/floci:latest` |

---

## Network access modes

Open **Network & Access** (`/settings/network`) in the sidebar.

1. **Local Machine (`local`)**
   - Single-device development.
   - Endpoint: `http://localhost:4566`.
   - Generates `localhost` database (`psql`/`mysql`), Redis, SSH and AWS CLI commands.

2. **LAN / Local Wi-Fi (`lan`)**
   - Access across your subnet or office network.
   - Accepts private ranges (`192.168.*`, `10.*`, `172.16–31.*`) and local hostnames (`.local`, `.lan`).
   - Detects and suggests available LAN addresses.

3. **Tailscale / Private VPN (`tailscale`)**
   - Secure tailnet connectivity through a CGNAT IP (`100.x.x.x`) or MagicDNS (`*.ts.net`).
   - No public exposure or open ports required.

4. **Custom Host / Reverse Proxy (`custom`)**
   - Custom private domains, TLS (`https://`), Nginx / Traefik / Caddy and VPN gateways.

The dashboard rewrites internal container addresses returned by the engine to the public host you configure, so connection strings never leak Docker IPs.

---

## Running the app

### Development

```bash
npm run dev
```

Runs on **http://localhost:3050** with Turbopack and hot reload.

### Production

```bash
npm run build
npm run start
```

Runs on **http://localhost:3050**.

### Docker Compose

```bash
docker compose up -d --build
```

Useful commands:

```bash
docker compose logs -f dashboard
docker compose logs -f aakash
docker compose down
```

The dashboard stores its UI settings in `./aakash-dashboard-data/` (bind-mounted to `/app/data`). The engine stores state in `./aakash-data/`. The dashboard container fixes the mounted directory ownership automatically before dropping privileges.

### Production Server (Direct)

```bash
npm run build
npm run start
```

The production server starts on port `3050`.

---

## Project structure

```
app/                       Next.js App Router
  api/                     Typed API route handlers for every service
  settings/network/        Network and access configuration UI
  s3/ rds/ ec2/ ...        Service pages
components/                Layout, providers and shared UI primitives
lib/
  aws/                     AWS SDK client factory and environment validation
  network-config/          Persisted network settings, types and Zod schemas
  aakash-network.ts        Endpoint and connection-string generation engine
  aakash-network-server.ts Server-side wrappers for the network engine
  backend-paths.ts         Configurable backend admin hooks
  logger.ts                Structured server logging (pino)
data/                      Runtime data and persisted UI configuration (created automatically)
tests/                     Vitest unit and API integration tests
install.sh                 Linux / macOS installer
install.ps1 / install.bat  Windows installers
Dockerfile                 Multi-stage production image (Next.js standalone)
docker-entrypoint.sh       Container volume-permission bootstrap
docker-compose.yml         Engine + dashboard stack
```

---

## npm scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Start the development server on port `3050` |
| `npm run build` | Create an optimized production build |
| `npm run start` | Start the production server on port `3050` |
| `npm run test` | Run the Vitest suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | Run the Next.js linter |

---

## API routes

All routes return JSON and use consistent error shapes: `{ "error": { "code": "...", "message": "..." } }`.

| Route | Methods | Purpose |
| :--- | :--- | :--- |
| `/api/health` | `GET`, `POST` | Backend health; `POST` resets state |
| `/api/network-config` | `GET`, `PUT` | Read/update network settings |
| `/api/network-config/test` | `POST` | Test a candidate endpoint |
| `/api/network-config/reset` | `POST` | Reset network settings to defaults |
| `/api/s3` | `GET`, `POST`, `DELETE` | Buckets |
| `/api/s3/[bucket]/objects` | `GET`, `POST`, `DELETE` | Objects |
| `/api/s3/[bucket]/objects/download` | `GET` | Download an object |
| `/api/rds` | `GET`, `POST`, `DELETE` | Database instances |
| `/api/rds/test` | `POST` | Test a database connection |
| `/api/rds/extension` | `POST` | Install a database extension |
| `/api/ec2` | `GET`, `POST` | Instances |
| `/api/ec2/[instanceId]/action` | `POST` | Start / stop / terminate |
| `/api/elasticache` | `GET`, `POST`, `DELETE` | Redis / Valkey clusters |
| `/api/lambda` | `GET`, `POST`, `DELETE` | Functions |
| `/api/lambda/[functionName]/invoke` | `POST` | Invoke a function |
| `/api/sqs` | `GET`, `POST`, `DELETE` | Queues |
| `/api/sqs/messages` | `GET`, `POST`, `DELETE` | Queue messages |
| `/api/sns` | `GET`, `POST`, `DELETE` | Topics |
| `/api/sns/publish` | `POST` | Publish a message |
| `/api/ses` | `GET`, `POST`, `DELETE` | Identities |
| `/api/ses/send` | `POST` | Send an email |
| `/api/ses/messages` | `GET` | Captured inbox |

---

## Testing and quality

```bash
npm run build       # also generates next-env.d.ts on a fresh clone
npm run typecheck   # TypeScript
npm run test        # Vitest (47 tests)
npm run lint        # ESLint
```

The suite covers the network engine, environment validation, API routes and shared components. Tests use a temporary configuration file and do not modify your saved settings.

---

## Troubleshooting

### `node: command not found` or Node is too old

Install Node 20+ from **https://nodejs.org**. The bash installer can install Node 22 automatically through `nvm` or Homebrew; the PowerShell installer uses `winget` or Chocolatey.

### Port `3050` or `4566` is already in use

Linux / macOS:

```bash
lsof -i :3050
lsof -i :4566
```

Windows:

```powershell
netstat -ano | findstr :3050
netstat -ano | findstr :4566
```

Stop the conflicting process or change the port in the npm script / compose file.

### Docker permission denied (Linux)

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

### The dashboard shows **OFFLINE**

1. Confirm the engine is running: `curl http://localhost:4566`.
2. Confirm `AAKASH_ENDPOINT` in `.env.local` matches the engine.
3. If you use Docker, the dashboard must reach `http://aakash:4566` inside the compose network.
4. Check the server logs with `docker compose logs -f dashboard` or the terminal running `npm run start`.

### Reset button does not clear data

The reset button calls the backend admin hook configured by `AAKASH_BACKEND_RESET_PATH`. If you run a custom engine, set that variable to the route your engine implements.

### The captured SES inbox is empty

Set `AAKASH_BACKEND_SES_MESSAGES_PATH` to the inspection route exposed by your engine. The bundled engine works without extra configuration.

### Network settings are read-only

`AAKASH_CONFIG_LOCKED=true` is active. Remove it from `.env.local` (or set it to `false`) and restart the server.

### PowerShell blocks the installer

Use:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### `npm ci` fails

The lockfile may be out of sync. Run `npm install` to refresh it, then retry. The installers fall back to `npm install` automatically.

---

## Security notes

- Network settings are validated with Zod and block cloud-metadata targets and unsafe URI characters (SSRF protection).
- `AAKASH_CONFIG_LOCKED=true` makes network settings read-only for centrally managed deployments.
- Internal container addresses are never exposed in generated connection strings.
- The dashboard is intended for local, LAN or private-tailnet use. Put it behind your own authentication if you expose it beyond a trusted network.
- Never commit `.env.local` or real AWS credentials. The default `test` / `test` credentials are for the emulator only.

---

## Backend compatibility

Aakash Dashboard is the product surface. It uses the AWS SDK wire protocol, so it can talk to the bundled engine or any compatible emulator that speaks the same API.

The only backend-specific integration points are:

1. **Admin hooks** — `AAKASH_BACKEND_HEALTH_PATH`, `AAKASH_BACKEND_RESET_PATH`, `AAKASH_BACKEND_SES_MESSAGES_PATH`.
2. **Container image** — `AAKASH_EMULATOR_IMAGE`.

Both are environment-driven, so no code changes are needed to move the dashboard onto your own engine build.

---

## License

Internal / proprietary. All rights reserved.
