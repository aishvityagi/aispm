// ─── Risk Engine Types ───────────────────────────────────────────────────────

/**
 * What we send TO the risk engine for analysis.
 */
export interface AnalyzeRequest {
  request_id: string;
  content: string;          // The raw prompt text
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
export type ThreatTag =
  | "prompt_injection"
  | "jailbreak_attempt"
  | "pii_exposure"
  | "sensitive_data"
  | "hate_speech"
  | "violence"
  | "malware_generation"
  | "data_exfiltration"
  | "role_manipulation"
  | "none";

// ─── Policy Types ────────────────────────────────────────────────────────────

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
  priority: number;         // Lower number = evaluated first
}

export interface PolicyDecision {
  action: PolicyAction;
  rule_id: string | null;   // Which rule triggered (null = default allow)
  rule_name: string | null;
  reason: string;
}

// ─── Interceptor / Request Types ─────────────────────────────────────────────

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

// ─── Audit Types ─────────────────────────────────────────────────────────────

/**
 * One row in the audit_events table — the permanent record of every decision.
 */
export interface AuditEvent {
  id?: number;
  request_id: string;
  user_id: string;
  session_id: string;
  prompt_preview: string;   // First 200 chars only — never store full prompts
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

// ─── OpenAI-compatible Chat Types ────────────────────────────────────────────
// These match the shape of requests arriving at our gateway from any
// OpenAI-compatible client (e.g. the dashboard, curl, SDKs).

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
  user?: string;            // Optional end-user identifier from client
}

// ─── Risk Score (legacy alias kept for Phase 1 compatibility) ────────────────
export interface RiskScore {
  score: number;
  category: string;
  flags: string[];
}