// apps/gateway/src/plugins/redis.ts
// Redis plugin — wraps ioredis and registers it on the Fastify instance

const fp = require("fastify-plugin");
import { FastifyPluginAsync } from "fastify";
import Redis from "ioredis";
import crypto from "crypto";

// Extend Fastify's type system to include our redis client
declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
    getCachedRiskScore: (prompt: string) => Promise<any | null>;
    setCachedRiskScore: (prompt: string, result: any, ttlSeconds?: number) => Promise<void>;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    lazyConnect: true,
    retryStrategy: (times) => {
      // Retry with exponential backoff, max 3 seconds
      const delay = Math.min(times * 200, 3000);
      return delay;
    },
  });

  redis.on("connect", () => fastify.log.info("Redis connected"));
  redis.on("error", (err) => fastify.log.warn(`Redis error: ${err.message}`));

  await redis.connect().catch((err) => {
    fastify.log.warn(`Redis initial connect failed: ${err.message}. Caching disabled.`);
  });

  // Helper: generate a deterministic cache key from a prompt
  function promptCacheKey(prompt: string): string {
    const hash = crypto.createHash("sha256").update(prompt.trim()).digest("hex");
    return `aispm:risk:${hash}`;
  }

  // Helper: get cached risk score (returns null on miss or error)
  async function getCachedRiskScore(prompt: string): Promise<any | null> {
    try {
      const key = promptCacheKey(prompt);
      const cached = await redis.get(key);
      if (cached) {
        fastify.log.info(`Redis cache HIT for prompt hash ${key.slice(-12)}`);
        return JSON.parse(cached);
      }
    } catch (err: any) {
      fastify.log.warn(`Redis get error: ${err.message}`);
    }
    return null;
  }

  // Helper: store risk score result (TTL default: 5 minutes = 300 seconds)
  async function setCachedRiskScore(
    prompt: string,
    result: any,
    ttlSeconds = 300
  ): Promise<void> {
    try {
      const key = promptCacheKey(prompt);
      await redis.set(key, JSON.stringify(result), "EX", ttlSeconds);
      fastify.log.info(`Redis cache SET for prompt hash ${key.slice(-12)} TTL=${ttlSeconds}s`);
    } catch (err: any) {
      fastify.log.warn(`Redis set error: ${err.message}`);
    }
  }

  fastify.decorate("redis", redis);
  fastify.decorate("getCachedRiskScore", getCachedRiskScore);
  fastify.decorate("setCachedRiskScore", setCachedRiskScore);

  // Graceful shutdown
  fastify.addHook("onClose", async () => {
    await redis.quit();
    fastify.log.info("Redis connection closed.");
  });
};

export default fp(redisPlugin, { name: "redis" });