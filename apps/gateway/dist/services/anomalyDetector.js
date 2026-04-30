"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAnomalies = checkAnomalies;
const HIGH_RISK_THRESHOLD = 0.7;
const MAX_REQUESTS_PER_MINUTE = 10;
const RATE_KEY_TTL = 60;
const CONSECUTIVE_HIGH_RISK_LIMIT = 3;
const CONSECUTIVE_KEY_TTL = 300;
async function checkAnomalies(fastify, userId, riskScore) {
    const reasons = [];
    const redis = fastify.redis;
    // 1. Rate check — >10 requests/min from same user
    const rateKey = `anomaly:rate:${userId}`;
    try {
        const count = await redis.incr(rateKey);
        if (count === 1)
            await redis.expire(rateKey, RATE_KEY_TTL);
        if (count > MAX_REQUESTS_PER_MINUTE) {
            reasons.push(`Rate exceeded: ${count} requests in 60s (max ${MAX_REQUESTS_PER_MINUTE})`);
        }
    }
    catch (err) {
        fastify.log.warn({ err }, "Redis error during rate check");
    }
    // 2. Off-hours check — before 6am or after 11pm
    const hour = new Date().getHours();
    if (hour < 6 || hour >= 23) {
        reasons.push(`Off-hours access at hour ${hour} (allowed: 6am–11pm)`);
    }
    // 3. Consecutive high risk scores from same user
    const consecutiveKey = `anomaly:consecutive:${userId}`;
    try {
        if (riskScore >= HIGH_RISK_THRESHOLD) {
            const streak = await redis.incr(consecutiveKey);
            if (streak === 1)
                await redis.expire(consecutiveKey, CONSECUTIVE_KEY_TTL);
            if (streak >= CONSECUTIVE_HIGH_RISK_LIMIT) {
                reasons.push(`${streak} consecutive high-risk scores (>=${HIGH_RISK_THRESHOLD})`);
            }
        }
        else {
            await redis.del(consecutiveKey);
        }
    }
    catch (err) {
        fastify.log.warn({ err }, "Redis error during consecutive risk check");
    }
    return { isAnomaly: reasons.length > 0, reasons };
}
//# sourceMappingURL=anomalyDetector.js.map