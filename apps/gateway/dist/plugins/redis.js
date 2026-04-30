"use strict";
// apps/gateway/src/plugins/redis.ts
// Redis plugin — wraps ioredis and registers it on the Fastify instance
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fp = require("fastify-plugin");
const ioredis_1 = __importDefault(require("ioredis"));
const crypto_1 = __importDefault(require("crypto"));
const redisPlugin = async (fastify) => {
    const redis = new ioredis_1.default({
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
    function promptCacheKey(prompt) {
        const hash = crypto_1.default.createHash("sha256").update(prompt.trim()).digest("hex");
        return `aispm:risk:${hash}`;
    }
    // Helper: get cached risk score (returns null on miss or error)
    async function getCachedRiskScore(prompt) {
        try {
            const key = promptCacheKey(prompt);
            const cached = await redis.get(key);
            if (cached) {
                fastify.log.info(`Redis cache HIT for prompt hash ${key.slice(-12)}`);
                return JSON.parse(cached);
            }
        }
        catch (err) {
            fastify.log.warn(`Redis get error: ${err.message}`);
        }
        return null;
    }
    // Helper: store risk score result (TTL default: 5 minutes = 300 seconds)
    async function setCachedRiskScore(prompt, result, ttlSeconds = 300) {
        try {
            const key = promptCacheKey(prompt);
            await redis.set(key, JSON.stringify(result), "EX", ttlSeconds);
            fastify.log.info(`Redis cache SET for prompt hash ${key.slice(-12)} TTL=${ttlSeconds}s`);
        }
        catch (err) {
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
exports.default = fp(redisPlugin, { name: "redis" });
//# sourceMappingURL=redis.js.map