# ── Build stage ───────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/policy-core  ./packages/policy-core
COPY apps/gateway          ./apps/gateway

RUN npm install
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=packages/policy-core
RUN npm run build --workspace=apps/gateway

# ── Runtime stage ─────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/node_modules         ./node_modules
COPY --from=builder /app/apps/gateway/dist    ./dist
COPY --from=builder /app/apps/gateway/package.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
