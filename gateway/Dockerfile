FROM node:22-alpine

WORKDIR /app
COPY policy.mjs server.mjs ./

ENV NODE_ENV=production \
    GATEWAY_PORT=4567

# Unprivileged: the gateway only needs to read the keys file and reach the emulator.
USER node
EXPOSE 4567

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4567/__gateway/health >/dev/null 2>&1 || exit 1

CMD ["node", "server.mjs"]
