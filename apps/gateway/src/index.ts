import * as dotenv from "dotenv";
dotenv.config();

import helmet from '@fastify/helmet';
import Fastify from "fastify";
import cors = require("@fastify/cors");
import jwt = require("@fastify/jwt");
import rateLimit = require("@fastify/rate-limit");
import { databasePlugin } from "./plugins/database";
import { proxyRoutes } from "./routes/proxy";
import redisPlugin from "./plugins/redis";
import authPlugin from "./plugins/auth";
const kafkaPlugin = require("./plugins/kafka");
const { policyEnginePlugin } = require("./plugins/policyEngine");
import { policyRoutes } from "./routes/policies";

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

async function start(): Promise<void> {
  try {
    await (fastify.register as any)(cors, {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    });

    await (fastify.register as any)(helmet, {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});

    await (fastify.register as any)(rateLimit, {
      max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
      timeWindow: "1 minute",
    });

    await (fastify.register as any)(jwt, {
      secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
    });

    // Infrastructure plugins
    await (fastify.register as any)(databasePlugin);
    await (fastify.register as any)(redisPlugin);
    await (fastify.register as any)(authPlugin);

    // Phase 4 plugins â€” register AFTER db and redis
    await (fastify.register as any)(kafkaPlugin);
    await (fastify.register as any)(policyEnginePlugin);

    // Routes
    await (fastify.register as any)(proxyRoutes);
    await (fastify.register as any)(policyRoutes);
    const { searchRoutes } = require('./routes/search');
await (fastify.register as any)(searchRoutes);

const { healthRoutes } = require('./routes/health');
await (fastify.register as any)(healthRoutes);
const { authRoutes } = require('./routes/auth');
await (fastify.register as any)(authRoutes);
    fastify.get("/health", async () => ({
      status: "healthy",
      phase: 4,
      timestamp: new Date().toISOString(),
      services: { gateway: "up", database: "up", redis: "up", kafka: "up" },
    }));

    const port = parseInt(process.env.PORT || "3000");
    const host = process.env.HOST || "0.0.0.0";
    await fastify.listen({ port, host });
    fastify.log.info(`Gateway running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
