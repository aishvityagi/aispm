"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = healthRoutes;
const elasticsearch_1 = require("../lib/elasticsearch");
const kafkajs_1 = require("kafkajs");
async function checkPostgres(fastify) {
    const start = Date.now();
    try {
        await fastify.db.query('SELECT 1');
        return { status: 'ok', latency_ms: Date.now() - start };
    }
    catch (err) {
        return { status: 'error', error: err.message };
    }
}
async function checkRedis(fastify) {
    const start = Date.now();
    try {
        await fastify.redis.ping();
        return { status: 'ok', latency_ms: Date.now() - start };
    }
    catch (err) {
        return { status: 'error', error: err.message };
    }
}
async function checkKafka() {
    const start = Date.now();
    const kafka = new kafkajs_1.Kafka({
        clientId: 'health-check',
        brokers: [process.env.KAFKA_BROKERS || 'localhost:29092'],
    });
    const admin = kafka.admin();
    try {
        await admin.connect();
        await admin.listTopics();
        await admin.disconnect();
        return { status: 'ok', latency_ms: Date.now() - start };
    }
    catch (err) {
        return { status: 'error', error: err.message };
    }
}
async function checkElasticsearch() {
    const start = Date.now();
    try {
        await elasticsearch_1.esClient.ping();
        return { status: 'ok', latency_ms: Date.now() - start };
    }
    catch (err) {
        return { status: 'error', error: err.message };
    }
}
async function healthRoutes(fastify) {
    fastify.get('/v1/health/detailed', async (_req, reply) => {
        const [postgres, redis, kafka, elasticsearch] = await Promise.all([
            checkPostgres(fastify),
            checkRedis(fastify),
            checkKafka(),
            checkElasticsearch(),
        ]);
        const allOk = [postgres, redis, kafka, elasticsearch].every((s) => s.status === 'ok');
        return reply.code(allOk ? 200 : 503).send({
            status: allOk ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            services: { postgres, redis, kafka, elasticsearch },
        });
    });
}
//# sourceMappingURL=health.js.map