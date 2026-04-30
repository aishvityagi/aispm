import { Kafka } from "kafkajs";
import { Pool } from "pg";
import { indexAuditEvent, ensureIndex } from "../lib/elasticsearch";

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://aispm:aispm@localhost:5432/aispm";
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || "localhost:29092";

console.log("[AuditConsumer] Using DATABASE_URL:", DATABASE_URL);
console.log("[AuditConsumer] Using KAFKA_BROKERS:", KAFKA_BROKERS);

const TOPICS = [
  "ai.requests.inbound",
  "ai.responses.outbound",
  "ai.risk.scored",
  "ai.policy.violations",
  "ai.anomalies.detected",
];

async function startConsumer() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  const kafka = new Kafka({
    clientId: "aispm-audit-consumer",
    brokers: KAFKA_BROKERS.split(","),
  });

  const consumer = kafka.consumer({ groupId: "audit-consumer-group" });

  // Ensure Elasticsearch index exists before starting
  await ensureIndex();

  await consumer.connect();
  console.log("[AuditConsumer] Connected to Kafka");

  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  console.log(`[AuditConsumer] Subscribed to: ${TOPICS.join(", ")}`);

  await consumer.run({
    eachMessage: async ({ topic, message }: any) => {
      const raw = message.value?.toString();
      if (!raw) return;

      let payload: any;
      try {
        payload = JSON.parse(raw);
      } catch {
        console.warn(`[AuditConsumer] Bad message on ${topic}:`, raw);
        return;
      }

      console.log(`[AuditConsumer] ${topic} →`, JSON.stringify(payload, null, 2));

      // Always write raw event to kafka_events table
      try {
        await pool.query(
          `INSERT INTO kafka_events (topic, payload) VALUES ($1, $2)`,
          [topic, JSON.stringify(payload)]
        );
        console.log(`[AuditConsumer] DB write success for topic: ${topic}`);
      } catch (err: any) {
        console.warn(`[AuditConsumer] DB write failed:`, err.message);
      }

      // Index into Elasticsearch by fetching the full row from audit_events
      // Only do this for topics that carry an eventId and have full audit data
      if (
        (topic === "ai.risk.scored" || topic === "ai.responses.outbound") &&
        payload.eventId
      ) {
        try {
          // Retry up to 5 times waiting for logAuditEvent to write to PostgreSQL
let row = null;
for (let attempt = 1; attempt <= 5; attempt++) {
  await new Promise((r) => setTimeout(r, 1000 * attempt)); // 1s, 2s, 3s, 4s, 5s
  const result = await pool.query(
    `SELECT * FROM audit_events WHERE request_id = $1 LIMIT 1`,
    [payload.eventId]
  );
          

          if (result.rows.length > 0) {
    row = result.rows[0];
    break;
  }
  console.warn(`[AuditConsumer] Attempt ${attempt}: no row yet for eventId: ${payload.eventId}`);
}

if (row) {
  const r = row;
  await indexAuditEvent({
              id:               row.id,
              user_id:          row.user_id,
              prompt:           row.prompt_preview,
              response:         row.response_preview,
              risk_score:       row.risk_score,
              threat_category:  Array.isArray(row.threats) ? row.threats[0] : null,
              action_taken:     row.policy_action,
              policy_triggered: row.rule_triggered,
              ip_address:       row.ip_address,
              timestamp:        row.timestamp,
              model:            row.model,
              tokens_used:      row.latency_ms,
            });
            console.log(`[AuditConsumer] Elasticsearch indexed eventId: ${payload.eventId}`);
          } else {
            console.warn(
              `[AuditConsumer] No audit_events row found for eventId: ${payload.eventId}`
            );
          }
        } catch (err: any) {
          console.warn(`[AuditConsumer] Elasticsearch indexing failed:`, err.message);
        }
      }
    },
  });

  process.on("SIGINT", async () => {
    console.log("[AuditConsumer] Shutting down...");
    await consumer.disconnect();
    await pool.end();
    process.exit(0);
  });
}

startConsumer().catch((err) => {
  console.error("[AuditConsumer] Fatal error:", err);
  process.exit(1);
});