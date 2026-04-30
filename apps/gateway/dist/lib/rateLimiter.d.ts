export declare function checkUserRateLimit(fastify: any, userId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    retryAfter?: number;
}>;
//# sourceMappingURL=rateLimiter.d.ts.map