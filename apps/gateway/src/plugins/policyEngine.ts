import { FastifyInstance } from "fastify";
import { sharedPolicyEngine } from "../shared/policyEngineInstance";

export async function policyEnginePlugin(fastify: FastifyInstance) {
  async function loadRules() {
    try {
      const result = await fastify.db.query(
        "SELECT * FROM policy_rules ORDER BY created_at ASC"
      );
      sharedPolicyEngine.loadFromDB(result.rows);
      fastify.log.info("[PolicyLoader] Loaded " + result.rows.length + " rules from DB");
    } catch (err) {
      fastify.log.error("[PolicyLoader] Failed to load rules from DB");
      fastify.log.error(err);
    }
  }

  await loadRules();
  setInterval(loadRules, 30000);
}
