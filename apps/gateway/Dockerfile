# ── Build stage ───────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package files
COPY package.json ./
COPY turbo.json ./

# Copy packages
COPY packages/shared-types ./packages/shared-types
COPY packages/policy-core ./packages/policy-core

# Copy gateway
COPY apps/gateway ./apps/gateway

# Install all dependencies
RUN npm install --legacy-peer-deps

# Build shared-types
WORKDIR /app/packages/shared-types
RUN npx tsc

# Build policy-core
WORKDIR /app/packages/policy-core
RUN npx tsc

# Build gateway
WORKDIR /app/apps/gateway
RUN npx tsc

# ── Runtime stage ─────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=builder /app/packages/policy-core/dist ./packages/policy-core/dist
COPY --from=builder /app/packages/policy-core/package.json ./packages/policy-core/package.json
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=builder /app/apps/gateway/package.json ./apps/gateway/package.json

WORKDIR /app/apps/gateway

EXPOSE 3000
CMD ["node", "dist/index.js"]