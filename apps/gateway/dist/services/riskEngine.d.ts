export interface RiskResult {
    score: number;
    threats: string[];
    recommendation: string;
    explanation: string;
}
export declare function analyzePrompt(requestId: string, content: string, userId?: string, sessionId?: string): Promise<RiskResult>;
//# sourceMappingURL=riskEngine.d.ts.map