"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPICS = void 0;
const fp = require("fastify-plugin");
const kafkajs_1 = require("kafkajs");
exports.TOPICS = {
    REQUESTS_INBOUND: "ai.requests.inbound",
    RESPONSES_OUTBOUND: "ai.responses.outbound",
    RISK_SCORED: "ai.risk.scored",
    POLICY_VIOLATIONS: "ai.policy.violations",
    ANOMALIES_DETECTED: "ai.anomalies.detected",
};
async function kafkaPlugin(fastify, options) {
    const brokers = (process.env.KAFKA_BROKERS || "localhost:29092").split(",");
    const kafka = new kafkajs_1.Kafka({
        clientId: "aispm-gateway",
        brokers,
        retry: { retries: 3 },
    });
    const producer = kafka.producer();
    try {
        await producer.connect();
        fastify.log.info("Kafka producer connected");
    }
    catch (err) {
        fastify.log.warn({ err }, "Kafka producer failed to connect — events will be skipped");
    }
    async function publish(topic, payload) {
        try {
            await producer.send({
                topic,
                messages: [
                    {
                        key: String(payload.userId ?? "anonymous"),
                        value: JSON.stringify({ ...payload, publishedAt: new Date().toISOString() }),
                    },
                ],
            });
        }
        catch (err) {
            fastify.log.warn({ err, topic }, "Kafka publish failed — continuing");
        }
    }
    fastify.decorate("kafka", { publish, TOPICS: exports.TOPICS });
    fastify.addHook("onClose", async () => {
        try {
            await producer.disconnect();
        }
        catch (err) {
            fastify.log.warn({ err }, "Error disconnecting Kafka producer");
        }
    });
}
module.exports = fp(kafkaPlugin, { name: "kafka" });
//# sourceMappingURL=kafka.js.map