// Tests for Elasticsearch indexing and search

const mockIndex = jest.fn().mockResolvedValue({ result: 'created' });
const mockSearch = jest.fn();
const mockIndicesExists = jest.fn();
const mockIndicesCreate = jest.fn().mockResolvedValue({});
const mockPing = jest.fn().mockResolvedValue(true);

jest.mock('@elastic/elasticsearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    index: mockIndex,
    search: mockSearch,
    ping: mockPing,
    indices: {
      exists: mockIndicesExists,
      create: mockIndicesCreate,
    },
  })),
}));

import { indexAuditEvent, searchAuditEvents, ensureIndex } from '../lib/elasticsearch';

describe('ensureIndex', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates index if it does not exist', async () => {
    mockIndicesExists.mockResolvedValue(false);

    await ensureIndex();

    expect(mockIndicesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ index: 'audit_events' })
    );
  });

  it('skips creation if index already exists', async () => {
    mockIndicesExists.mockResolvedValue(true);

    await ensureIndex();

    expect(mockIndicesCreate).not.toHaveBeenCalled();
  });
});

describe('indexAuditEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('indexes a document with correct fields', async () => {
    const event = {
      id: 1,
      user_id: 'user-123',
      prompt: 'Tell me about quantum computing',
      response: 'Quantum computing is...',
      risk_score: 0.1,
      threat_category: 'none',
      action_taken: 'allow',
      policy_triggered: null,
      ip_address: '127.0.0.1',
      timestamp: '2026-04-28T00:00:00.000Z',
      model: 'llama-3.3-70b-versatile',
      tokens_used: 100,
    };

    await indexAuditEvent(event);

    expect(mockIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'audit_events',
        id: '1',
        document: expect.objectContaining({
          prompt: 'Tell me about quantum computing',
          user_id: 'user-123',
        }),
      })
    );
  });

  it('does not throw if indexing fails', async () => {
    mockIndex.mockRejectedValue(new Error('ES connection failed'));

    await expect(indexAuditEvent({ id: 1 })).resolves.not.toThrow();
  });
});

describe('searchAuditEvents', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns mapped results from Elasticsearch', async () => {
    mockSearch.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              prompt: 'quantum computing',
              user_id: 'user-123',
              risk_score: 0.1,
            },
            _score: 1.5,
          },
        ],
      },
    });

    const results = await searchAuditEvents('quantum', 10);

    expect(results).toHaveLength(1);
    expect(results[0].prompt).toBe('quantum computing');
    expect(results[0]._score).toBe(1.5);
  });

  it('returns empty array on search failure', async () => {
    mockSearch.mockRejectedValue(new Error('Search failed'));

    const results = await searchAuditEvents('quantum', 10);

    expect(results).toEqual([]);
  });

  it('uses multi_match query across correct fields', async () => {
    mockSearch.mockResolvedValue({ hits: { hits: [] } });

    await searchAuditEvents('test query', 5);

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'audit_events',
        size: 5,
        query: expect.objectContaining({
          multi_match: expect.objectContaining({
            query: 'test query',
            fields: expect.arrayContaining(['prompt', 'response']),
          }),
        }),
      })
    );
  });
});