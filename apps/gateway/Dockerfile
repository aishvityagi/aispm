FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/policy-core ./packages/policy-core
COPY apps/gateway ./apps/gateway

# Install dependencies
RUN npm install --legacy-peer-deps

WORKDIR /app/apps/gateway

EXPOSE 3000
CMD ["node", "dist/index.js"]