import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { searchAuditEvents } from '../lib/elasticsearch';

interface SearchQuery {
  q?: string;
  limit?: string;
}

export async function searchRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/v1/search',
    async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
      const { q, limit } = request.query;

      if (!q || q.trim() === '') {
        return reply.code(400).send({ error: 'Query parameter "q" is required' });
      }

      const parsedLimit = Math.min(parseInt(limit || '20', 10), 100);
      const results = await searchAuditEvents(q.trim(), parsedLimit);

      return reply.send({
        query: q,
        total: results.length,
        results,
      });
    }
  );
}