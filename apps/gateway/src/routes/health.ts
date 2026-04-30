import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { esClient } from '../lib/elasticsearch';
import { Kafka } from 'kafkajs';

async function checkPostgres(fastify: any): Promise<{ status: string; latency_ms?: number; error?: string }> {
  const start = Date.now();
  try {
    await fastify.db.query('SELECT 1');
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

async function checkRedis(fastify: any): Promise<{ status: string; latency_ms?: number; error?: string }> {
  const start = Date.now();
  try {
    await fastify.redis.ping();
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

async function checkKafka(): Promise<{ status: string; latency_ms?: number; error?: string }> {
  const start = Date.now();
  const kafka = new Kafka({
    clientId: 'health-check',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:29092'],
  });
  const admin = kafka.admin();
  try {
    await admin.connect();
    await admin.listTopics();
    await admin.disconnect();
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

async function checkElasticsearch(): Promise<{ status: string; latency_ms?: number; error?: string }> {
  const start = Date.now();
  try {
    await esClient.ping();
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/v1/health/detailed',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const [postgres, redis, kafka, elasticsearch] = await Promise.all([
        checkPostgres(fastify),
        checkRedis(fastify),
        checkKafka(),
        checkElasticsearch(),
      ]);

      const allOk = [postgres, redis, kafka, elasticsearch].every(
        (s) => s.status === 'ok'
      );

      return reply.code(allOk ? 200 : 503).send({
        status: allOk ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        services: { postgres, redis, kafka, elasticsearch },
      });
    }
  );
}