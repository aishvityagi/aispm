import { FastifyInstance } from "fastify";
export interface AnomalyResult {
    isAnomaly: boolean;
    reasons: string[];
}
export declare function checkAnomalies(fastify: FastifyInstance, userId: string, riskScore: number): Promise<AnomalyResult>;
//# sourceMappingURL=anomalyDetector.d.ts.map