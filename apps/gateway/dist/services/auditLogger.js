"use strict";
/**
 * Audit Logger
 * Inserts a permanent record of every intercepted request into PostgreSQL.
 * Called after every policy decision — even blocked requests are logged.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = logAuditEvent;
exports.getRecentEvents = getRecentEvents;
exports.getStats = getStats;
/**
 * Write an audit event to the database.
 * Errors are caught and logged — we never want a logging failure
 * to crash the request pipeline.
 */
async function logAuditEvent(db, event) {
    const query = `
    INSERT INTO audit_events (
      request_id,
      user_id,
      session_id,
      prompt_preview,
      model,
      risk_score,
      threats,
      policy_action,
      rule_triggered,
      response_preview,
      latency_ms,
      ip_address,
      timestamp
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
  `;
    const values = [
        event.request_id,
        event.user_id,
        event.session_id,
        // Truncate to 200 chars — we never store full prompts in audit logs
        event.prompt_preview.slice(0, 200),
        event.model,
        event.risk_score,
        event.threats, // pg driver handles TEXT[]
        event.policy_action,
        event.rule_triggered ?? null,
        event.response_preview
            ? event.response_preview.slice(0, 200) // Truncate response preview too
            : null,
        event.latency_ms ?? null,
        event.ip_address ?? null,
        event.timestamp,
    ];
    try {
        await db.query(query, values);
    }
    catch (err) {
        // Log the error but don't re-throw — audit failure ≠ request failure
        console.error("[auditLogger] Failed to write audit event:", err);
        console.error("[auditLogger] Event that failed:", {
            request_id: event.request_id,
            policy_action: event.policy_action,
            risk_score: event.risk_score,
        });
    }
}
/**
 * Query recent audit events — used by the dashboard API.
 */
async function getRecentEvents(db, limit = 50, offset = 0) {
    const result = await db.query(`SELECT * FROM audit_events
     ORDER BY timestamp DESC
     LIMIT $1 OFFSET $2`, [limit, offset]);
    return result.rows;
}
/**
 * Get aggregate stats for the dashboard.
 */
async function getStats(db) {
    const result = await db.query(`
    SELECT
      COUNT(*)                                        AS total,
      COUNT(*) FILTER (WHERE policy_action = 'block') AS blocked,
      COUNT(*) FILTER (WHERE policy_action = 'redact') AS redacted,
      COUNT(*) FILTER (WHERE policy_action = 'allow')  AS allowed,
      ROUND(AVG(risk_score)::numeric, 3)              AS avg_risk_score
    FROM audit_events
  `);
    const row = result.rows[0];
    return {
        total: parseInt(row.total),
        blocked: parseInt(row.blocked),
        redacted: parseInt(row.redacted),
        allowed: parseInt(row.allowed),
        avgRiskScore: parseFloat(row.avg_risk_score) || 0,
    };
}
//# sourceMappingURL=auditLogger.js.map