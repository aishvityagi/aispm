"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRoutes = searchRoutes;
const elasticsearch_1 = require("../lib/elasticsearch");
async function searchRoutes(fastify) {
    fastify.get('/v1/search', async (request, reply) => {
        const { q, limit } = request.query;
        if (!q || q.trim() === '') {
            return reply.code(400).send({ error: 'Query parameter "q" is required' });
        }
        const parsedLimit = Math.min(parseInt(limit || '20', 10), 100);
        const results = await (0, elasticsearch_1.searchAuditEvents)(q.trim(), parsedLimit);
        return reply.send({
            query: q,
            total: results.length,
            results,
        });
    });
}
//# sourceMappingURL=search.js.map