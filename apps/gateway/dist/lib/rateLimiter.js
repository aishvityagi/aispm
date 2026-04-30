"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUserRateLimit = checkUserRateLimit;
const kafkajs_1 = require("kafkajs");
require('dotenv').config({ path: require("path").resolve(__dirname, "../../.env") });
const RATE_LIMIT = 50;
const WINDOW_SECONDS = 3600;
const KAFKA_BROKER = process.env.KAFKA_BROKER || process.env.KAFKA_BROKERS || 'localhost:29092';
const kafka = new kafkajs_1.Kafka({
    clientId: 'rate-limiter',
    brokers: [KAFKA_BROKER],
});
const producer = kafka.producer();
let producerConnected = false;
producer.connect().then(() => {
    producerConnected = true;
    console.log('[RateLimiter] Kafka producer connected');
}).catch((err) => {
    console.error('[RateLimiter] Kafka producer connection failed:', err);
});
async function checkUserRateLimit(fastify, userId) {
    const key = `rate_limit:user:${userId}`;
    try {
        const redis = fastify.redis;
        const current = await redis.incr(key);
        if (current === 1) {
            await redis.expire(key, WINDOW_SECONDS);
        }
        if (current > RATE_LIMIT) {
            const ttl = await redis.ttl(key);
            if (producerConnected) {
                await producer.send({
                    topic: 'ai.anomalies.detected',
                    messages: [
                        {
                            key: userId,
                            value: JSON.stringify({
                                anomaly_type: 'rate_limit_exceeded',
                                user_id: userId,
                                current_count: current,
                                limit: RATE_LIMIT,
                                window_seconds: WINDOW_SECONDS,
                                retry_after: ttl,
                                timestamp: new Date().toISOString(),
                            }),
                        },
                    ],
                });
            }
            return { allowed: false, current, limit: RATE_LIMIT, retryAfter: ttl };
        }
        return { allowed: true, current, limit: RATE_LIMIT };
    }
    catch (err) {
        console.error('[RateLimiter] Redis error — allowing request:', err);
        return { allowed: true, current: 0, limit: RATE_LIMIT };
    }
}
//# sourceMappingURL=rateLimiter.js.map