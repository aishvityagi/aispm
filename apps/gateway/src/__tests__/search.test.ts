import Fastify from 'fastify';
import { searchRoutes } from '../routes/search';

const mockSearchAuditEvents = jest.fn();

jest.mock('../lib/elasticsearch', () => ({
  esClient: { ping: jest.fn() },
  ensureIndex: jest.fn(),
  indexAuditEvent: jest.fn(),
  searchAuditEvents: (...args: any[]) => mockSearchAuditEvents(...args),
}));

async function buildApp() {
  const app = Fastify();
  await app.register(searchRoutes);
  return app;
}

describe('GET /v1/search', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when q parameter is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/search',
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
  });

  it('returns 400 when q is empty string', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/search?q=',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns search results with correct shape', async () => {
    mockSearchAuditEvents.mockResolvedValue([
      { id: 1, prompt: 'quantum computing', user_id: 'user-123', risk_score: 0.1 },
      { id: 2, prompt: 'quantum entanglement', user_id: 'user-456', risk_score: 0.2 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/search?q=quantum&limit=10',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.query).toBe('quantum');
    expect(body.total).toBe(2);
    expect(body.results).toHaveLength(2);
  });

  it('caps limit at 100', async () => {
    mockSearchAuditEvents.mockResolvedValue([]);
    await app.inject({ method: 'GET', url: '/v1/search?q=test&limit=999' });
    expect(mockSearchAuditEvents).toHaveBeenCalledWith('test', 100);
  });

  it('defaults limit to 20', async () => {
    mockSearchAuditEvents.mockResolvedValue([]);
    await app.inject({ method: 'GET', url: '/v1/search?q=test' });
    expect(mockSearchAuditEvents).toHaveBeenCalledWith('test', 20);
  });

  it('returns empty results array when nothing found', async () => {
    mockSearchAuditEvents.mockResolvedValue([]);
    const res = await app.inject({ method: 'GET', url: '/v1/search?q=nonexistent' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.total).toBe(0);
    expect(body.results).toEqual([]);
  });
});