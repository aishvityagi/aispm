import { Pool } from "pg";
import { FastifyInstance, FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    db: Pool;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    database: process.env.POSTGRES_DB || "aispm",
    user: process.env.POSTGRES_USER || "aispm_user",
    password: process.env.POSTGRES_PASSWORD || "aispm_pass",
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    fastify.log.info("✅ PostgreSQL connected successfully");
    client.release();
  } catch (err) {
    fastify.log.error({ err }, "❌ PostgreSQL connection failed");
    throw err;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id               SERIAL PRIMARY KEY,
      request_id       UUID NOT NULL,
      user_id          TEXT NOT NULL,
      session_id       TEXT NOT NULL,
      prompt_preview   TEXT NOT NULL,
      model            TEXT NOT NULL,
      risk_score       NUMERIC(4, 3) NOT NULL,
      threats          TEXT[] NOT NULL DEFAULT '{}',
      policy_action    TEXT NOT NULL,
      rule_triggered   TEXT,
      response_preview TEXT,
      latency_ms       INTEGER,
      ip_address       TEXT,
      timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_request_id ON audit_events (request_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events (timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_policy_action ON audit_events (policy_action);
    CREATE INDEX IF NOT EXISTS idx_audit_risk_score ON audit_events (risk_score DESC);
  `);

  fastify.log.info("✅ audit_events table ready");
  fastify.decorate("db", pool);

  fastify.addHook("onClose", async () => {
    await pool.end();
    fastify.log.info("PostgreSQL pool closed");
  });
};

// CommonJS-compatible export — no fastify-plugin wrapper needed for dev
(databasePlugin as any)[Symbol.for("skip-override")] = true;
export { databasePlugin };