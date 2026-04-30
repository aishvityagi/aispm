/**
 * Proxy Route — /v1/chat/completions
 *
 * This is the core interceptor. Every AI request flows through here:
 *
 *  1. Parse the incoming OpenAI-compatible chat completion request
 *  2. Extract the prompt text from the messages array
 *  3. Check Redis cache — if hit, use cached risk result (skip risk engine)
 *  4. On cache miss: call the risk engine → get score + threat tags, then cache result
 *  5. Run the PolicyEngine → get allow / block / redact decision
 *  6a. BLOCK  → return 403 with reason, log event
 *  6b. REDACT → strip detected PII patterns, forward scrubbed prompt
 *  6c. ALLOW  → forward to Groq, stream response back
 *  7. Log every decision to the audit_events table
 */
const TOPICS = {
  REQUESTS_INBOUND: "ai.requests.inbound",
  RESPONSES_OUTBOUND: "ai.responses.outbound",
  RISK_SCORED: "ai.risk.scored",
  POLICY_VIOLATIONS: "ai.policy.violations",
  ANOMALIES_DETECTED: "ai.anomalies.detected",
};
import { checkUserRateLimit } from '../lib/rateLimiter';
import { checkAnomalies } from "../services/anomalyDetector";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { sharedPolicyEngine } from "../shared/policyEngineInstance";
import {
  ChatCompletionRequest,
  InterceptedRequest,
  ThreatTag,
} from "@aispm/shared-types";
import { analyzePrompt, RiskResult } from "../services/riskEngine";
import { forwardToGroq } from "../services/groqClient";
import { logAuditEvent } from "../services/auditLogger";

// ─── PII Redaction Patterns ───────────────────────────────────────────────────
const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[REDACTED-SSN]",
  },
  {
    pattern:
      /\b(?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12})\b/g,
    replacement: "[REDACTED-CC]",
  },
  {
    pattern:
      /\b(api[_\-]?key|api[_\-]?secret|access[_\-]?token|auth[_\-]?token)\s*[:=]\s*['"]?[A-Za-z0-9\-_]{20,}/gi,
    replacement: "$1=[REDACTED-KEY]",
  },
  {
    pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: "[REDACTED-AWS-KEY]",
  },
  {
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END[^-]*-----/g,
    replacement: "[REDACTED-PRIVATE-KEY]",
  },
  {
    pattern: /(postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@[^\s'"]+/gi,
    replacement: "$1://[REDACTED-CONNSTRING]",
  },
  {
    pattern: /\b(password|passwd|pwd)\s*[:=]\s*['"]?\S{8,}/gi,
    replacement: "$1=[REDACTED-PWD]",
  },
];

function redactContent(content: string): string {
  let redacted = content;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

function extractPromptText(messages: ChatCompletionRequest["messages"]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
}


// ─── Route Registration ───────────────────────────────────────────────────────

export async function proxyRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/v1/chat/completions",
    async (
      request: FastifyRequest<{ Body: ChatCompletionRequest }>,
      reply: FastifyReply
    ) => {
      const requestStart = Date.now();
      const requestId = uuidv4();
      const user = (request as any).user;
const userId = user?.username || user?.sub || user?.userId || "anonymous";
      // Per-user rate limit check

      
      const sessionId =
        (request.headers["x-session-id"] as string | undefined) ?? uuidv4();

      const body = request.body;

      if (!body?.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
        return reply.status(400).send({
          error: {
            message: "messages array is required and must not be empty",
            type: "invalid_request_error",
            code: "invalid_messages",
          },
        });
      }

      const promptText = extractPromptText(body.messages);
      const model = body.model || "llama-3.3-70b-versatile";

      const rateCheck = await checkUserRateLimit(fastify, userId);
if (!rateCheck.allowed) {
  // Log to audit_events
  try {
    await logAuditEvent(fastify.db, {
      request_id: requestId,
      user_id: userId,
      session_id: sessionId,
      prompt_preview: '[RATE LIMIT EXCEEDED]',
      model: body.model || 'unknown',
      risk_score: 1.0,
      threats: [],
      policy_action: 'block',
      rule_triggered: 'rate_limit',
      latency_ms: 0,
      ip_address: request.ip,
      timestamp: new Date(),
    });
  } catch (dbErr) {
    console.error('[RateLimit] Failed to log to audit_events:', dbErr);
  }

  reply.header('X-RateLimit-Limit', String(rateCheck.limit));
  reply.header('X-RateLimit-Remaining', '0');
  reply.header('Retry-After', String(rateCheck.retryAfter));
  return reply.code(429).send({
    error: 'rate_limit_exceeded',
    message: `You have exceeded the limit of ${rateCheck.limit} requests per hour. Please try again in ${rateCheck.retryAfter} seconds.`,
    retry_after: rateCheck.retryAfter,
  });
}
      request.log.info(
        { requestId, userId, model, promptLength: promptText.length },
        "Intercepted request"
      );

      // ── Step 1: Risk Analysis (with Redis cache) ────────────────────
      let riskResult = await fastify.getCachedRiskScore(promptText);

      if (riskResult) {
        request.log.info({ requestId }, "Risk score served from Redis cache");
      } else {
        riskResult = await analyzePrompt(requestId, promptText, userId, sessionId);
        await fastify.setCachedRiskScore(promptText, riskResult);
      }

      request.log.info(
        {
          requestId,
          score: riskResult.score,
          threats: riskResult.threats,
          recommendation: riskResult.recommendation,
        },
        "Risk analysis complete"
      );

      // ── Step 2: Build InterceptedRequest for PolicyEngine ───────────
      const intercepted: InterceptedRequest = {
        request_id: requestId,
        user_id: userId,
        session_id: sessionId,
        prompt: promptText,
        model,
        timestamp: new Date(),
        risk_score: riskResult.score,
        threats: riskResult.threats as ThreatTag[],
        ip_address: request.ip,
        user_agent: request.headers["user-agent"],
      };

      // ── Step 3: Policy Decision ──────────────────────────────────────
   request.log.info({ 
  requestId, 
  risk_score: riskResult.score, 
  threats: riskResult.threats,
  recommendation: riskResult.recommendation 
}, "Pre-policy evaluation");
const decision = sharedPolicyEngine.evaluate(intercepted);

      request.log.info(
        { requestId, action: decision.action, rule: decision.rule_name },
        "Policy decision made"
      );

      // ── Step 3b: Publish risk scored event ───────────────────────────
      await (fastify as any).kafka.publish(TOPICS.RISK_SCORED, {
        eventId: requestId,
        userId,
        riskScore: riskResult.score,
        threats: riskResult.threats,
        timestamp: new Date().toISOString(),
      });

      // ── Step 3c: Anomaly detection ────────────────────────────────────
      const anomaly = await checkAnomalies(fastify, userId, riskResult.score);
      if (anomaly.isAnomaly) {
        await (fastify as any).kafka.publish(TOPICS.ANOMALIES_DETECTED, {
          eventId: requestId,
          userId,
          reasons: anomaly.reasons,
          riskScore: riskResult.score,
          timestamp: new Date().toISOString(),
        });
        request.log.warn({ userId, reasons: anomaly.reasons }, "Anomaly detected");
      }

      // ── Step 4a: BLOCK ───────────────────────────────────────────────
      if (decision.action === "block") {
        await (fastify as any).kafka.publish(TOPICS.POLICY_VIOLATIONS, {
          eventId: requestId,
          userId,
          ruleId: decision.rule_id,
          ruleName: decision.rule_name,
          action: "block",
          riskScore: riskResult.score,
          timestamp: new Date().toISOString(),
        });

        await logAuditEvent(fastify.db, {
          request_id: requestId,
          user_id: userId,
          session_id: sessionId,
          prompt_preview: promptText,
          model,
          risk_score: riskResult.score,
          threats: riskResult.threats as ThreatTag[],
          policy_action: "block",
          rule_triggered: decision.rule_name,
          latency_ms: Date.now() - requestStart,
          ip_address: request.ip,
          timestamp: new Date(),
        });

        return reply.status(403).send({
          error: {
            message: "Request blocked by AI security policy",
            type: "policy_violation",
            code: "request_blocked",
            details: {
              request_id: requestId,
              rule: decision.rule_name,
              reason: decision.reason,
              risk_score: riskResult.score,
              threats: riskResult.threats,
            },
          },
        });
      }

      // ── Step 4b/c: REDACT or ALLOW — forward to Groq ────────────────
      let forwardMessages = body.messages;
      if (decision.action === "redact") {
        forwardMessages = body.messages.map((msg) => ({
          ...msg,
          content:
            msg.role === "user" || msg.role === "system"
              ? redactContent(msg.content)
              : msg.content,
        }));

        await (fastify as any).kafka.publish(TOPICS.POLICY_VIOLATIONS, {
          eventId: requestId,
          userId,
          ruleId: decision.rule_id,
          ruleName: decision.rule_name,
          action: "redact",
          riskScore: riskResult.score,
          timestamp: new Date().toISOString(),
        });

        request.log.info({ requestId }, "Content redacted before forwarding to Groq");
      }

      // Publish inbound request event
      await (fastify as any).kafka.publish(TOPICS.REQUESTS_INBOUND, {
        eventId: requestId,
        userId,
        model,
        promptLength: promptText.length,
        timestamp: new Date().toISOString(),
      });

      const forwardRequest: ChatCompletionRequest = {
        ...body,
        messages: forwardMessages,
      };

      const shouldStream = body.stream === true;

      try {
        const { fullText, latencyMs } = await forwardToGroq(
          forwardRequest,
          reply,
          shouldStream
        );

        // Publish outbound response event
        await (fastify as any).kafka.publish(TOPICS.RESPONSES_OUTBOUND, {
          eventId: requestId,
          userId,
          model,
          durationMs: latencyMs,
          timestamp: new Date().toISOString(),
        });

        await logAuditEvent(fastify.db, {
          request_id: requestId,
          user_id: userId,
          session_id: sessionId,
          prompt_preview: promptText,
          model,
          risk_score: riskResult.score,
          threats: riskResult.threats as ThreatTag[],
          policy_action: decision.action,
          rule_triggered: decision.rule_name,
          response_preview: fullText,
          latency_ms: latencyMs,
          ip_address: request.ip,
          timestamp: new Date(),
        });

        request.log.info(
          { requestId, action: decision.action, latencyMs },
          "Request completed"
        );
      } catch (err) {
        request.log.error({ requestId, err }, "Groq forwarding failed");

        await logAuditEvent(fastify.db, {
          request_id: requestId,
          user_id: userId,
          session_id: sessionId,
          prompt_preview: promptText,
          model,
          risk_score: riskResult.score,
          threats: riskResult.threats as ThreatTag[],
          policy_action: "allow",
          rule_triggered: null,
          response_preview: `ERROR: ${(err as Error).message}`,
          latency_ms: Date.now() - requestStart,
          ip_address: request.ip,
          timestamp: new Date(),
        });

        return reply.status(502).send({
          error: {
            message: "Failed to reach AI model provider",
            type: "upstream_error",
            code: "groq_unreachable",
            request_id: requestId,
          },
        });
      }
    }
  );
  // ── Audit log query endpoint ─────────────────────────────────────────────
    fastify.get(
    "/v1/audit/events",
    async (
      request: FastifyRequest<{
        Querystring: { limit?: string; offset?: string };
      }>,
      reply: FastifyReply
    ) => {
      const limit = Math.min(parseInt(request.query.limit ?? "50"), 200);
      const offset = parseInt(request.query.offset ?? "0");

      const result = await fastify.db.query(
        `SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      return reply.send({
        events: result.rows,
        limit,
        offset,
        returned: result.rows.length,
      });
    }
  );

  // ── Stats endpoint ────────────────────────────────────────────────────────
  fastify.get("/v1/audit/stats", async (_request, reply) => {
    const result = await fastify.db.query(`
      SELECT
        COUNT(*)::int                                         AS total,
        COUNT(*) FILTER (WHERE policy_action = 'block')::int  AS blocked,
        COUNT(*) FILTER (WHERE policy_action = 'redact')::int AS redacted,
        COUNT(*) FILTER (WHERE policy_action = 'allow')::int  AS allowed,
        ROUND(AVG(risk_score)::numeric, 3)                   AS avg_risk_score
      FROM audit_events
    `);

    return reply.send(result.rows[0]);
  });
}
