// apps/gateway/src/lib/elasticsearch.ts
// Elasticsearch 8.x client — single node, no security (dev config)

import { Client } from '@elastic/elasticsearch';

const ES_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const INDEX_NAME = 'audit_events';

export const esClient = new Client({ node: ES_URL });

// Create the index with mappings if it doesn't exist
export async function ensureIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: INDEX_NAME });
    if (exists) {
      console.log('[Elasticsearch] Index audit_events already exists');
      return;
    }

    await esClient.indices.create({
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
          ip_address: { type: 'ip' },
          timestamp: { type: 'date' },
          model: { type: 'keyword' },
          tokens_used: { type: 'integer' },
        },
      },
    });

    console.log('[Elasticsearch] Created index: audit_events');
  } catch (err) {
    console.error('[Elasticsearch] Failed to ensure index:', err);
  }
}

// Index a single audit event document
export async function indexAuditEvent(event: Record<string, any>): Promise<void> {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: String(event.id),
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
  } catch (err) {
    console.error('[Elasticsearch] Failed to index audit event:', err);
  }
}

// Full-text search across prompt and response fields
export async function searchAuditEvents(
  query: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const result = await esClient.search({
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

    return result.hits.hits.map((hit: any) => ({
      ...hit._source,
      _score: hit._score,
    }));
  } catch (err) {
    console.error('[Elasticsearch] Search failed:', err);
    return [];
  }
}

export { INDEX_NAME };