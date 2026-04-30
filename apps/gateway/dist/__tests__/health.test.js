"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const mockQuery = jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
const mockPing = jest.fn().mockResolvedValue(true);
const mockRedisPing = jest.fn().mockResolvedValue('PONG');
const mockListTopics = jest.fn().mockResolvedValue(['ai.requests.inbound']);
const mockAdminConnect = jest.fn().mockResolvedValue(undefined);
const mockAdminDisconnect = jest.fn().mockResolvedValue(undefined);
jest.mock('kafkajs', () => ({
    Kafka: jest.fn().mockImplementation(() => ({
        admin: () => ({
            connect: mockAdminConnect,
            listTopics: mockListTopics,
            disconnect: mockAdminDisconnect,
        }),
    })),
}));
jest.mock('../lib/elasticsearch', () => ({
    esClient: { ping: mockPing },
    ensureIndex: jest.fn(),
    indexAuditEvent: jest.fn(),
    searchAuditEvents: jest.fn(),
}));
async function buildApp() {
    const app = (0, fastify_1.default)();
    // Use (app as any) to bypass TypeScript strict type checking on decorators
    app.decorate('db', { query: mockQuery });
    app.decorate('redis', { ping: mockRedisPing });
    const { healthRoutes } = require('../routes/health');
    await app.register(healthRoutes);
    return app;
}
describe('GET /v1/health/detailed', () => {
    let app;
    beforeAll(async () => {
        app = await buildApp();
    });
    afterAll(async () => {
        await app.close();
    });
    beforeEach(() => jest.clearAllMocks());
    it('returns 200 when all services are healthy', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ result: 1 }] });
        mockRedisPing.mockResolvedValueOnce('PONG');
        mockAdminConnect.mockResolvedValueOnce(undefined);
        mockListTopics.mockResolvedValueOnce([]);
        mockAdminDisconnect.mockResolvedValueOnce(undefined);
        mockPing.mockResolvedValueOnce(true);
        const res = await app.inject({
            method: 'GET',
            url: '/v1/health/detailed',
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.status).toBe('ok');
        expect(body.services.postgres.status).toBe('ok');
        expect(body.services.redis.status).toBe('ok');
        expect(body.services.kafka.status).toBe('ok');
        expect(body.services.elasticsearch.status).toBe('ok');
    });
    it('returns 503 when postgres is down', async () => {
        mockQuery.mockRejectedValueOnce(new Error('Connection refused'));
        const res = await app.inject({
            method: 'GET',
            url: '/v1/health/detailed',
        });
        expect(res.statusCode).toBe(503);
        const body = JSON.parse(res.body);
        expect(body.status).toBe('degraded');
        expect(body.services.postgres.status).toBe('error');
    });
    it('returns 503 when elasticsearch is down', async () => {
        mockPing.mockRejectedValueOnce(new Error('ES offline'));
        const res = await app.inject({
            method: 'GET',
            url: '/v1/health/detailed',
        });
        expect(res.statusCode).toBe(503);
        const body = JSON.parse(res.body);
        expect(body.status).toBe('degraded');
        expect(body.services.elasticsearch.status).toBe('error');
    });
    it('includes latency_ms for healthy services', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/v1/health/detailed',
        });
        const body = JSON.parse(res.body);
        expect(body.services.postgres.latency_ms).toBeDefined();
        expect(typeof body.services.postgres.latency_ms).toBe('number');
    });
    it('includes timestamp in response', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/v1/health/detailed',
        });
        const body = JSON.parse(res.body);
        expect(body.timestamp).toBeDefined();
        expect(new Date(body.timestamp).getTime()).not.toBeNaN();
    });
});
//# sourceMappingURL=health.test.js.map