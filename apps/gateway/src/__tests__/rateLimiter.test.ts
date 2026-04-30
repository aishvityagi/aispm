// Tests for per-user rate limiting logic

const mockIncr = jest.fn();
const mockExpire = jest.fn();
const mockTtl = jest.fn();
const mockSend = jest.fn();
const mockConnect = jest.fn().mockResolvedValue(undefined);

// Mock Kafka producer
jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: () => ({
      connect: mockConnect,
      send: mockSend,
    }),
  })),
}));

import { checkUserRateLimit } from '../lib/rateLimiter';

const mockFastify = {
  redis: {
    incr: mockIncr,
    expire: mockExpire,
    ttl: mockTtl,
  },
};

describe('checkUserRateLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows request when under limit', async () => {
    mockIncr.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const result = await checkUserRateLimit(mockFastify, 'user-123');

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(result.limit).toBe(50);
  });

  it('sets expiry on first request', async () => {
    mockIncr.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    await checkUserRateLimit(mockFastify, 'user-123');

    expect(mockExpire).toHaveBeenCalledWith('rate_limit:user:user-123', 3600);
  });

  it('does not reset expiry on subsequent requests', async () => {
    mockIncr.mockResolvedValue(5);

    await checkUserRateLimit(mockFastify, 'user-123');

    expect(mockExpire).not.toHaveBeenCalled();
  });

  it('blocks request when over limit', async () => {
    mockIncr.mockResolvedValue(51);
    mockTtl.mockResolvedValue(3500);

    const result = await checkUserRateLimit(mockFastify, 'user-123');

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBe(3500);
  });

  it('allows request when Redis fails (fail open)', async () => {
    mockIncr.mockRejectedValue(new Error('Redis connection failed'));

    const result = await checkUserRateLimit(mockFastify, 'user-123');

    expect(result.allowed).toBe(true);
  });

  it('uses correct Redis key format', async () => {
    mockIncr.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    await checkUserRateLimit(mockFastify, 'test-user-456');

    expect(mockIncr).toHaveBeenCalledWith('rate_limit:user:test-user-456');
  });

  it('publishes to Kafka when rate limit exceeded', async () => {
    mockIncr.mockResolvedValue(51);
    mockTtl.mockResolvedValue(3500);

    await checkUserRateLimit(mockFastify, 'user-123');

    // Give Kafka producer time to connect and send
    await new Promise((r) => setTimeout(r, 100));

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'ai.anomalies.detected',
        messages: expect.arrayContaining([
          expect.objectContaining({
            key: 'user-123',
          }),
        ]),
      })
    );
  });
});