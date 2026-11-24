# Deploy Aakash behind a Cloudflare Tunnel

Run Aakash on a server and reach it from anywhere on your own domain, with no open ports.

```
Browser ─► Cloudflare Access login ─► Tunnel ─► dashboard   (aakash.<domain>)
CLI/SDK ─► signed AWS requests     ─► Tunnel ─► gateway ─► emulator   (api.<domain>)
Anyone  ─► public file URL         ─► Tunnel ─► gateway ─► emulator   (files.<domain>, public buckets only)
```

| Hostname | Goes to | Protected by |
| --- | --- | --- |
| `aakash.<domain>` | `http://dashboard:3050` | Cloudflare Access (your email) **and** a token check inside the app |
| `api.<domain>` | `http://gateway:4567` | AWS Signature V4 with an access key you created. Unsigned requests, the dev key `test` and `/_floci/*` admin paths are refused |
| `files.<domain>` | `http://gateway:4567` | Nothing, by design. Read-only, and only objects a bucket policy makes public |

## 1. Create a dedicated tunnel

Zero Trust → Networks → Tunnels → **Create a tunnel** → connector **Docker**. Copy the token.
Use a new tunnel for Aakash rather than one you already run, so Aakash's routes stay separate from your other apps.

Add three public hostnames to it (table above). The services are reached by their Docker names (`dashboard`, `gateway`).

## 2. Protect the dashboard with Cloudflare Access

Zero Trust → Access → Applications → **Add** → Self-hosted, domain `aakash.<domain>`.
Add a policy that allows only your email. Do **not** attach an Access policy to `api.` or `files.`.

Note two values: your **team domain** (`<team>.cloudflareaccess.com`) and the application's **AUD tag**.

## 3. Start the stack

```bash
cp .env.cloudflare.example .env      # fill in the token, hostnames, team domain and AUD
docker compose -f docker-compose.cloudflare.yml up -d --build
docker compose -f docker-compose.cloudflare.yml ps     # all should become healthy
```

This stack replaces `docker-compose.yml`; do not run both on one host. Every published port is bound to
`127.0.0.1`, so nothing is reachable except through the tunnel. If `CF_ACCESS_*` is missing or wrong, the
dashboard answers 401/503 rather than opening up.

## 4. Create an access key and use the API

```bash
./scripts/create-api-key.sh laptop
```

It prints an access key id and secret (shown once) and allow-lists the id in the gateway immediately.

```bash
export AWS_ACCESS_KEY_ID=...  AWS_SECRET_ACCESS_KEY=...  AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=https://api.<domain>

aws s3 mb s3://my-bucket
aws s3 cp ./photo.png s3://my-bucket/img/photo.png
aws s3 presign s3://my-bucket/img/photo.png --expires-in 3600     # temporary link, works from anywhere
```

### Public files

A bucket is private until you attach a normal S3 bucket policy, exactly as on AWS:

```bash
aws s3api put-bucket-policy --bucket my-bucket --policy '{
  "Version":"2012-10-17",
  "Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::my-bucket/img/*"}]
}'
# now anyone can read: https://files.<domain>/my-bucket/img/photo.png
```

The files hostname never lists a bucket and never accepts writes.

## Recommended Cloudflare settings

- **Rate limiting** on `api.<domain>` (Security → WAF → Rate limiting rules), e.g. 100 requests per 10 seconds per IP.
- Cloudflare caps a request body at **100 MB** on Free and Pro plans. The AWS CLI and SDKs split large files into
  multipart parts well under that, so large uploads work. A single `PutObject` over 100 MB does not.

## Known limits (honest list)

- RDS and ElastiCache are TCP. A tunnel does not give anonymous clients a plain `host:port`; clients run
  `cloudflared access tcp`. Per-database hostnames are **not automated yet**.
- Presigned **POST** (browser form) uploads are refused by the gateway, because their credential sits in the form
  body. Presigned **PUT/GET** URLs work.
- The emulator holds the Docker socket, which is root-equivalent on the host. The gateway and signature checks
  stop outsiders from reaching it, but anyone holding one of your access keys is effectively an admin. Treat keys
  like root credentials and revoke ones you no longer use.
