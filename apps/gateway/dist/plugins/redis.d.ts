import Redis from "ioredis";
declare module "fastify" {
    interface FastifyInstance {
        redis: Redis;
        getCachedRiskScore: (prompt: string) => Promise<any | null>;
        setCachedRiskScore: (prompt: string, result: any, ttlSeconds?: number) => Promise<void>;
    }
}
declare const _default: any;
export default _default;
//# sourceMappingURL=redis.d.ts.map