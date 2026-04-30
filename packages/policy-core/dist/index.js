"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyEngine = exports.DEFAULT_RULES = void 0;
const ALWAYS_BLOCK_TAGS = [
    "prompt_injection",
    "jailbreak_attempt",
    "malware_generation",
    "data_exfiltration",
    "hate_speech",
    "violence",
    "role_manipulation",
];
const ALWAYS_REDACT_TAGS = ["pii_exposure", "sensitive_data"];
exports.DEFAULT_RULES = [
    {
        id: "rule-critical-score",
        name: "Block Critical Risk Score",
        description: "Block any request with a risk score of 0.85 or above",
        priority: 1,
        action: "block",
        condition: (req) => (req.risk_score ?? 0) >= 0.85,
    },
    {
        id: "rule-block-tags",
        name: "Block Dangerous Threat Tags",
        description: "Block requests containing any always-block threat categories",
        priority: 2,
        action: "block",
        condition: (req) => (req.threats ?? []).some((tag) => ALWAYS_BLOCK_TAGS.includes(tag)),
    },
    {
        id: "rule-redact-pii",
        name: "Redact PII and Sensitive Data",
        description: "Redact requests that contain PII or sensitive credentials",
        priority: 3,
        action: "redact",
        condition: (req) => (req.threats ?? []).some((tag) => ALWAYS_REDACT_TAGS.includes(tag)),
    },
    {
        id: "rule-elevated-score",
        name: "Block Elevated Risk Score",
        description: "Block requests with a risk score between 0.65 and 0.85",
        priority: 4,
        action: "block",
        condition: (req) => (req.risk_score ?? 0) >= 0.65,
    },
    {
        id: "rule-moderate-score",
        name: "Redact Moderate Risk Score",
        description: "Redact requests with a risk score between 0.40 and 0.65",
        priority: 5,
        action: "redact",
        condition: (req) => (req.risk_score ?? 0) >= 0.40,
    },
];
function buildCondition(field, operator, value) {
    return (req) => {
        let fieldValue = "";
        if (field === "prompt")
            fieldValue = req.prompt ?? "";
        else if (field === "user_id")
            fieldValue = req.user_id ?? "";
        else if (field === "model")
            fieldValue = req.model ?? "";
        else if (field === "risk_score") {
            const score = req.risk_score ?? 0;
            const num = parseFloat(value);
            if (operator === "greater_than")
                return score > num;
            if (operator === "less_than")
                return score < num;
            if (operator === "equals")
                return score === num;
            return false;
        }
        else if (field === "threat_category") {
            fieldValue = (req.threats ?? []).join(" ");
        }
        else {
            fieldValue = String(req[field] ?? "");
        }
        const lower = fieldValue.toLowerCase();
        const val = value.toLowerCase();
        switch (operator) {
            case "contains": return lower.includes(val);
            case "not_contains": return !lower.includes(val);
            case "equals": return lower === val;
            case "not_equals": return lower !== val;
            case "regex":
                try {
                    return new RegExp(value, "i").test(fieldValue);
                }
                catch {
                    return false;
                }
            default: return false;
        }
    };
}
class PolicyEngine {
    defaultRules;
    customRules;
    constructor(customRules) {
        this.defaultRules = [...exports.DEFAULT_RULES].sort((a, b) => a.priority - b.priority);
        this.customRules = customRules ?? [];
    }
    evaluate(request) {
        // Custom (DB) rules run FIRST
        for (const rule of this.customRules) {
            if (rule.condition(request)) {
                return {
                    action: rule.action,
                    rule_id: rule.id,
                    rule_name: rule.name,
                    reason: rule.description ?? "Custom policy rule matched",
                };
            }
        }
        // Then default rules
        for (const rule of this.defaultRules) {
            if (rule.condition(request)) {
                return {
                    action: rule.action,
                    rule_id: rule.id,
                    rule_name: rule.name,
                    reason: rule.description ?? "",
                };
            }
        }
        return {
            action: "allow",
            rule_id: null,
            rule_name: null,
            reason: "No policy rule triggered - default allow",
        };
    }
    loadFromDB(rows) {
        this.customRules = rows
            .filter((row) => row.enabled !== false)
            .map((row, i) => {
            // Handle both formats:
            // Format A (flat): condition_field, operator, value columns
            // Format B (JSON): condition: { field, operator, value }
            let field;
            let operator;
            let value;
            if (row.condition_field) {
                // Flat format
                field = row.condition_field;
                operator = row.operator;
                value = row.value;
            }
            else if (row.condition) {
                // JSON format — may be string or object
                const cond = typeof row.condition === "string"
                    ? JSON.parse(row.condition)
                    : row.condition;
                field = cond.field;
                operator = cond.operator;
                value = cond.value;
            }
            else {
                return null;
            }
            if (!field || !operator || !value)
                return null;
            return {
                id: String(row.id),
                name: row.name,
                description: `DB rule: ${field} ${operator} "${value}"`,
                priority: row.priority ?? i + 1,
                action: row.action,
                condition: buildCondition(field, operator, value),
            };
        })
            .filter(Boolean);
        console.log(`[PolicyEngine] Loaded ${this.customRules.length} custom rules from DB`);
    }
    addRule(rule) {
        this.customRules.push(rule);
    }
    removeRule(id) {
        this.customRules = this.customRules.filter((r) => r.id !== id);
        this.defaultRules = this.defaultRules.filter((r) => r.id !== id);
    }
    clearCustomRules() {
        this.customRules = [];
    }
    getRules() {
        return [...this.customRules, ...this.defaultRules];
    }
}
exports.PolicyEngine = PolicyEngine;
//# sourceMappingURL=index.js.map