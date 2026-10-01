# syntax=docker/dockerfile:1

FROM node:22.13.0-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22.13.0-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run typecheck && npm test && npm run build

FROM node:22.13.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    CHAINPATCH_DB=/app/data/chainpatch.sqlite

RUN addgroup -S chainpatch && adduser -S chainpatch -G chainpatch
COPY --from=builder --chown=chainpatch:chainpatch /app/public ./public
COPY --from=builder --chown=chainpatch:chainpatch /app/.next/standalone ./
COPY --from=builder --chown=chainpatch:chainpatch /app/.next/static ./.next/static
RUN mkdir -p /app/data && chown chainpatch:chainpatch /app/data

USER chainpatch
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", "server.js"]
