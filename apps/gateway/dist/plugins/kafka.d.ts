export declare const TOPICS: {
    readonly REQUESTS_INBOUND: "ai.requests.inbound";
    readonly RESPONSES_OUTBOUND: "ai.responses.outbound";
    readonly RISK_SCORED: "ai.risk.scored";
    readonly POLICY_VIOLATIONS: "ai.policy.violations";
    readonly ANOMALIES_DETECTED: "ai.anomalies.detected";
};
export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];
//# sourceMappingURL=kafka.d.ts.map