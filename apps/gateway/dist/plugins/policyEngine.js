"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.policyEnginePlugin = policyEnginePlugin;
const policyEngineInstance_1 = require("../shared/policyEngineInstance");
async function policyEnginePlugin(fastify) {
    async function loadRules() {
        try {
            const result = await fastify.db.query("SELECT * FROM policy_rules ORDER BY created_at ASC");
            policyEngineInstance_1.sharedPolicyEngine.loadFromDB(result.rows);
            fastify.log.info("[PolicyLoader] Loaded " + result.rows.length + " rules from DB");
        }
        catch (err) {
            fastify.log.error("[PolicyLoader] Failed to load rules from DB");
            fastify.log.error(err);
        }
    }
    await loadRules();
    setInterval(loadRules, 30000);
}
//# sourceMappingURL=policyEngine.js.map