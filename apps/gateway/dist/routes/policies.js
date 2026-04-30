"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.policyRoutes = policyRoutes;
const uuid_1 = require("uuid");
const policyEngineInstance_1 = require("../shared/policyEngineInstance");
async function policyRoutes(fastify) {
    // GET /v1/policies
    fastify.get("/v1/policies", async (_request, reply) => {
        try {
            const result = await fastify.db.query("SELECT * FROM policy_rules ORDER BY created_at ASC");
            return reply.send(result.rows);
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: "Failed to fetch policies" });
        }
    });
    // POST /v1/policies
    fastify.post("/v1/policies", async (request, reply) => {
        try {
            const body = request.body;
            // Accept flat fields from dashboard: condition_field, operator, value
            // OR nested condition object from API: { condition: { field, operator, value } }
            let name = body.name;
            let action = body.action;
            let condition_field;
            let operator;
            let value;
            if (body.condition_field) {
                // Dashboard format (flat)
                condition_field = body.condition_field;
                operator = body.operator;
                value = body.value;
            }
            else if (body.condition && typeof body.condition === "object") {
                // API format (nested)
                condition_field = body.condition.field;
                operator = body.condition.operator;
                value = body.condition.value;
            }
            else {
                return reply.status(400).send({
                    error: "condition_field, operator, and value are required",
                });
            }
            if (!name || !action || !condition_field || !operator || !value) {
                return reply.status(400).send({
                    error: "name, action, condition_field, operator, and value are required",
                });
            }
            if (!["block", "redact", "allow", "flag"].includes(action)) {
                return reply.status(400).send({
                    error: "action must be block, redact, allow, or flag",
                });
            }
            const id = (0, uuid_1.v4)();
            // Try inserting with flat columns first, fall back to condition JSON
            let result;
            try {
                result = await fastify.db.query(`INSERT INTO policy_rules
               (id, name, condition_field, operator, value, action, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING *`, [id, name, condition_field, operator, value, action]);
            }
            catch (insertErr) {
                // Table might have different schema — try with condition JSON column
                if (insertErr.code === "42703") {
                    result = await fastify.db.query(`INSERT INTO policy_rules
                 (id, name, condition, action, priority, enabled, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())
               RETURNING *`, [
                        id,
                        name,
                        JSON.stringify({ field: condition_field, operator, value }),
                        action,
                        0,
                        true,
                    ]);
                }
                else {
                    throw insertErr;
                }
            }
            const newRule = result.rows[0];
            // Reload all rules into shared policy engine
            const allRules = await fastify.db.query("SELECT * FROM policy_rules ORDER BY created_at ASC");
            policyEngineInstance_1.sharedPolicyEngine.loadFromDB(allRules.rows);
            return reply.status(201).send(newRule);
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: "Failed to create policy" });
        }
    });
    // DELETE /v1/policies/:id
    fastify.delete("/v1/policies/:id", async (request, reply) => {
        try {
            const { id } = request.params;
            await fastify.db.query("DELETE FROM policy_rules WHERE id = $1", [id]);
            policyEngineInstance_1.sharedPolicyEngine.removeRule(id);
            // Reload remaining rules
            const allRules = await fastify.db.query("SELECT * FROM policy_rules ORDER BY created_at ASC");
            policyEngineInstance_1.sharedPolicyEngine.loadFromDB(allRules.rows);
            return reply.send({ success: true, message: `Rule ${id} deleted` });
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: "Failed to delete policy" });
        }
    });
}
//# sourceMappingURL=policies.js.map