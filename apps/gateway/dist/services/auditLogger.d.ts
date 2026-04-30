/**
 * Audit Logger
 * Inserts a permanent record of every intercepted request into PostgreSQL.
 * Called after every policy decision — even blocked requests are logged.
 */
import { Pool } from "pg";
import { AuditEvent } from "@aispm/shared-types";
/**
 * Write an audit event to the database.
 * Errors are caught and logged — we never want a logging failure
 * to crash the request pipeline.
 */
export declare function logAuditEvent(db: Pool, event: AuditEvent): Promise<void>;
/**
 * Query recent audit events — used by the dashboard API.
 */
export declare function getRecentEvents(db: Pool, limit?: number, offset?: number): Promise<AuditEvent[]>;
/**
 * Get aggregate stats for the dashboard.
 */
export declare function getStats(db: Pool): Promise<{
    total: number;
    blocked: number;
    redacted: number;
    allowed: number;
    avgRiskScore: number;
}>;
//# sourceMappingURL=auditLogger.d.ts.map