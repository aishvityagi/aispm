/**
 * What we send TO the risk engine for analysis.
 */
export interface AnalyzeRequest {
    request_id: string;
    content: string;
    user_id?: string;
    session_id?: string;
    metadata?: Record<string, unknown>;
}
/**
 * What the risk engine sends back.
 * score: 0.0 (safe) → 1.0 (critical threat)
 * threats: list of detected threat category tags
 * recommendation: the engine's suggested action
 */
export interface AnalyzeResponse {
    request_id: string;
    score: number;
    threats: ThreatTag[];
    recommendation: PolicyAction;
    explanation: string;
    processing_time_ms: number;
}
/**
 * Every threat type the risk engine can detect.
 */
export type ThreatTag = "prompt_injection" | "jailbreak_attempt" | "pii_exposure" | "sensitive_data" | "hate_speech" | "violence" | "malware_generation" | "data_exfiltration" | "role_manipulation" | "none";
/**
 * The three possible outcomes of policy evaluation.
 */
export type PolicyAction = "allow" | "block" | "redact";
export interface PolicyRule {
    id: string;
    name: string;
    description: string;
    condition: (request: InterceptedRequest) => boolean;
    action: PolicyAction;
    priority: number;
}
export interface PolicyDecision {
    action: PolicyAction;
    rule_id: string | null;
    rule_name: string | null;
    reason: string;
}
/**
 * The normalized request object passed between all internal services.
 */
export interface InterceptedRequest {
    request_id: string;
    user_id: string;
    session_id: string;
    prompt: string;
    model: string;
    timestamp: Date;
    risk_score?: number;
    threats?: ThreatTag[];
    ip_address?: string;
    user_agent?: string;
}
/**
 * One row in the audit_events table — the permanent record of every decision.
 */
export interface AuditEvent {
    id?: number;
    request_id: string;
    user_id: string;
    session_id: string;
    prompt_preview: string;
    model: string;
    risk_score: number;
    threats: ThreatTag[];
    policy_action: PolicyAction;
    rule_triggered: string | null;
    response_preview?: string;
    latency_ms?: number;
    timestamp: Date;
    ip_address?: string;
}
export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    user?: string;
}
export interface RiskScore {
    score: number;
    category: string;
    flags: string[];
}
//# sourceMappingURL=index.d.ts.map