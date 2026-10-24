#!/bin/sh
# Ensure the mounted data volume is writable by the unprivileged app user,
# then drop privileges and start the Next.js standalone server.
set -e

mkdir -p /app/data
chown -R nextjs:nodejs /app/data

exec su-exec nextjs "$@"
