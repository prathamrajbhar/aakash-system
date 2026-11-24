# syntax=docker/dockerfile:1

# 1. Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build the Next.js standalone bundle
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Minimal runtime image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3050
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache su-exec \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nextjs -u 1001 \
  && mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# The entrypoint starts as root only to fix the mounted data volume ownership,
# then drops to the unprivileged `nextjs` user before running the server.
EXPOSE 3050

# /api/healthz is the one route the auth middleware leaves open, so the probe
# works in every auth mode and reveals nothing about the deployment.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3050/api/healthz >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
