"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esClient = void 0;
exports.ensureIndex = ensureIndex;
exports.indexAuditEvent = indexAuditEvent;
exports.searchAuditEvents = searchAuditEvents;
const elasticsearch_1 = require("@elastic/elasticsearch");
const ES_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const INDEX_NAME = 'audit_events';
exports.esClient = new elasticsearch_1.Client({ node: ES_URL });
async function ensureIndex() {
    try {
        const exists = await exports.esClient.indices.exists({ index: INDEX_NAME });
        if (exists) {
            console.log('[Elasticsearch] Index audit_events already exists');
            return;
        }
        await exports.esClient.indices.create({
            index: INDEX_NAME,
            mappings: {
                properties: {
                    id: { type: 'keyword' },
                    user_id: { type: 'keyword' },
                    prompt: { type: 'text', analyzer: 'standard' },
                    response: { type: 'text', analyzer: 'standard' },
                    risk_score: { type: 'float' },
                    threat_category: { type: 'keyword' },
                    action_taken: { type: 'keyword' },
                    policy_triggered: { type: 'keyword' },
                    ip_address: { type: 'keyword' },
                    timestamp: { type: 'date' },
                    model: { type: 'keyword' },
                    tokens_used: { type: 'integer' },
                },
            },
        });
        console.log('[Elasticsearch] Created index: audit_events');
    }
    catch (err) {
        console.error('[Elasticsearch] Failed to ensure index:', err);
    }
}
async function indexAuditEvent(event) {
    try {
        await exports.esClient.index({
            index: INDEX_NAME,
            id: event.id ? String(event.id) : undefined,
            document: {
                id: event.id,
                user_id: event.user_id,
                prompt: event.prompt,
                response: event.response,
                risk_score: event.risk_score,
                threat_category: event.threat_category,
                action_taken: event.action_taken,
                policy_triggered: event.policy_triggered,
                ip_address: event.ip_address,
                timestamp: event.timestamp || new Date().toISOString(),
                model: event.model,
                tokens_used: event.tokens_used,
            },
        });
    }
    catch (err) {
        console.error('[Elasticsearch] Failed to index audit event:', err);
    }
}
async function searchAuditEvents(query, limit = 20) {
    try {
        const result = await exports.esClient.search({
            index: INDEX_NAME,
            size: limit,
            query: {
                multi_match: {
                    query,
                    fields: ['prompt', 'response', 'threat_category', 'user_id'],
                    type: 'best_fields',
                    fuzziness: 'AUTO',
                },
            },
            sort: [{ timestamp: { order: 'desc' } }],
        });
        return result.hits.hits.map((hit) => ({
            ...hit._source,
            _score: hit._score,
        }));
    }
    catch (err) {
        console.error('[Elasticsearch] Search failed:', err);
        return [];
    }
}
//# sourceMappingURL=elasticsearch.js.map