#!/usr/bin/env bash
# Creates an access key for the public Aakash API and allow-lists it in the gateway.
#
#   ./scripts/create-api-key.sh [label]
#
# The secret is printed once and never stored. Run it on the server that runs
# docker-compose.cloudflare.yml. It talks to the emulator over the Docker network
# (the emulator is not published), so it needs the stack to be running.
set -euo pipefail

LABEL="${1:-default}"
NETWORK="${AAKASH_DOCKER_NETWORK:-aakash_default}"
ENDPOINT="http://aakash:4566"
DATA_DIR="${AAKASH_DASHBOARD_DATA:-./aakash-dashboard-data}"
KEYS_FILE="$DATA_DIR/api-keys.json"
USER_NAME="aakash-api"

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "Docker network '$NETWORK' not found. Start the stack first." >&2
  exit 1
fi

# The dashboard container owns the data directory (uid 1001), so a normal user often cannot write
# to it. Fall back to a throwaway container that mounts it.
write_keys_file() { # reads the new file content on stdin
  if [[ -w "$DATA_DIR" ]]; then
    cat > "$KEYS_FILE.tmp" && chmod 644 "$KEYS_FILE.tmp" && mv "$KEYS_FILE.tmp" "$KEYS_FILE"
  else
    docker run --rm -i -v "$(cd "$DATA_DIR" && pwd):/data" alpine \
      sh -c 'cat > /data/api-keys.json.tmp && chmod 644 /data/api-keys.json.tmp && mv /data/api-keys.json.tmp /data/api-keys.json'
  fi
}

aws_cli() {
  # The emulator's dev credentials are accepted on the internal network only.
  docker run --rm --network "$NETWORK" \
    -e AWS_ACCESS_KEY_ID=test -e AWS_SECRET_ACCESS_KEY=test -e AWS_DEFAULT_REGION=us-east-1 \
    amazon/aws-cli --endpoint-url "$ENDPOINT" "$@"
}

mkdir -p "$DATA_DIR"

aws_cli iam get-user --user-name "$USER_NAME" >/dev/null 2>&1 \
  || aws_cli iam create-user --user-name "$USER_NAME" >/dev/null

read -r KEY_ID SECRET < <(aws_cli iam create-access-key --user-name "$USER_NAME" \
  --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)

if [[ ${#KEY_ID} -lt 16 ]]; then
  echo "Unexpected access key id from the emulator; refusing to allow-list it." >&2
  exit 1
fi

# Rebuild the allow-list: existing ids plus the new one. Only key ids are stored, never secrets.
{
  echo '{"keys":['
  if [[ -r "$KEYS_FILE" ]]; then
    grep -o '"accessKeyId": *"[A-Za-z0-9]*"' "$KEYS_FILE" \
      | sed 's/.*"\([A-Za-z0-9]*\)"$/\1/' \
      | while read -r existing; do printf '  {"accessKeyId":"%s"},\n' "$existing"; done
  fi
  printf '  {"accessKeyId":"%s","label":"%s"}\n' "$KEY_ID" "${LABEL//[^A-Za-z0-9 _.-]/_}"
  echo ']}'
} | write_keys_file || {
  echo "Could not write $KEYS_FILE; revoking the key that was just created." >&2
  aws_cli iam delete-access-key --user-name "$USER_NAME" --access-key-id "$KEY_ID" >/dev/null 2>&1 || true
  exit 1
}

API_HOST="${AAKASH_API_HOSTNAME:-<your-api-hostname>}"
cat <<EOF

Created access key for "$LABEL" (allow-listed in the gateway, no restart needed).
Save the secret now; it cannot be shown again.

  export AWS_ACCESS_KEY_ID=$KEY_ID
  export AWS_SECRET_ACCESS_KEY=$SECRET
  export AWS_DEFAULT_REGION=us-east-1
  export AWS_ENDPOINT_URL=https://$API_HOST

  aws s3 ls
EOF
