"use strict";
const { Pool } = require("pg");
require("dotenv").config();
async function migrate() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
    CREATE TABLE IF NOT EXISTS policy_rules (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      condition   JSONB NOT NULL,
      action      TEXT NOT NULL CHECK (action IN ('block', 'redact', 'allow')),
      priority    INTEGER NOT NULL DEFAULT 0,
      enabled     BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS kafka_events (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic       TEXT NOT NULL,
      payload     JSONB NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    console.log("Tables created (or already exist).");
    await pool.end();
}
migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
//# sourceMappingURL=migrate-policy.js.map