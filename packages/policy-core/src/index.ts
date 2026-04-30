import {
  InterceptedRequest,
  PolicyDecision,
  PolicyRule,
  ThreatTag,
} from "@aispm/shared-types";

const ALWAYS_BLOCK_TAGS: ThreatTag[] = [
  
  "jailbreak_attempt",
  "malware_generation",
  "data_exfiltration",
  "hate_speech",
  "violence",
  "role_manipulation",
];

const ALWAYS_REDACT_TAGS: ThreatTag[] = ["pii_exposure", "sensitive_data"];

export const DEFAULT_RULES: PolicyRule[] = [
  {
    id: "rule-critical-score",
    name: "Block Critical Risk Score",
    description: "Block any request with a risk score of 0.85 or above",
    priority: 1,
    action: "block",
    condition: (req: InterceptedRequest) => (req.risk_score ?? 0) >= 0.85,
  },
  {
    id: "rule-block-tags",
    name: "Block Dangerous Threat Tags",
    description: "Block requests containing any always-block threat categories",
    priority: 2,
    action: "block",
    condition: (req: InterceptedRequest) =>
      (req.threats ?? []).some((tag) => ALWAYS_BLOCK_TAGS.includes(tag as ThreatTag)),
  },
  {
    id: "rule-redact-pii",
    name: "Redact PII and Sensitive Data",
    description: "Redact requests that contain PII or sensitive credentials",
    priority: 3,
    action: "redact",
    condition: (req: InterceptedRequest) =>
      (req.threats ?? []).some((tag) => ALWAYS_REDACT_TAGS.includes(tag as ThreatTag)),
  },
  {
    id: "rule-elevated-score",
    name: "Block Elevated Risk Score",
    description: "Block requests with a risk score between 0.65 and 0.85",
    priority: 4,
    action: "block",
    condition: (req: InterceptedRequest) => (req.risk_score ?? 0) >= 0.65,
  },
  {
    id: "rule-moderate-score",
    name: "Redact Moderate Risk Score",
    description: "Redact requests with a risk score between 0.40 and 0.65",
    priority: 5,
    action: "redact",
    condition: (req: InterceptedRequest) => (req.risk_score ?? 0) >= 0.40,
  },
];

function buildCondition(field: string, operator: string, value: string) {
  return (req: InterceptedRequest): boolean => {
    let fieldValue = "";
    if (field === "prompt") fieldValue = req.prompt ?? "";
    else if (field === "user_id") fieldValue = req.user_id ?? "";
    else if (field === "model") fieldValue = req.model ?? "";
    else if (field === "risk_score") {
      const score = req.risk_score ?? 0;
      const num = parseFloat(value);
      if (operator === "greater_than") return score > num;
      if (operator === "less_than") return score < num;
      if (operator === "equals") return score === num;
      return false;
    } else if (field === "threat_category") {
      fieldValue = (req.threats ?? []).join(" ");
    } else {
      fieldValue = String((req as any)[field] ?? "");
    }

    const lower = fieldValue.toLowerCase();
    const val = value.toLowerCase();

    switch (operator) {
      case "contains":     return lower.includes(val);
      case "not_contains": return !lower.includes(val);
      case "equals":       return lower === val;
      case "not_equals":   return lower !== val;
case "regex":
        try { return new RegExp(value, "i").test(fieldValue); } catch { return false; }
      default: return false;
    }
  };
}

export class PolicyEngine {
  private defaultRules: PolicyRule[];
  private customRules: PolicyRule[];

  constructor(customRules?: PolicyRule[]) {
    this.defaultRules = [...DEFAULT_RULES].sort((a, b) => a.priority - b.priority);
    this.customRules = customRules ?? [];
  }

  evaluate(request: InterceptedRequest): PolicyDecision {
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

  loadFromDB(rows: any[]) {
    this.customRules = rows
      .filter((row) => row.enabled !== false)
      .map((row, i) => {
        // Handle both formats:
        // Format A (flat): condition_field, operator, value columns
        // Format B (JSON): condition: { field, operator, value }
        let field: string;
        let operator: string;
        let value: string;

        if (row.condition_field) {
          // Flat format
          field = row.condition_field;
          operator = row.operator;
          value = row.value;
        } else if (row.condition) {
          // JSON format — may be string or object
          const cond = typeof row.condition === "string"
            ? JSON.parse(row.condition)
            : row.condition;
          field = cond.field;
          operator = cond.operator;
          value = cond.value;
        } else {
          return null;
        }

        if (!field || !operator || !value) return null;

        return {
          id: String(row.id),
          name: row.name,
          description: `DB rule: ${field} ${operator} "${value}"`,
          priority: row.priority ?? i + 1,
          action: row.action,
          condition: buildCondition(field, operator, value),
        } as PolicyRule;
      })
      .filter(Boolean) as PolicyRule[];

    console.log(`[PolicyEngine] Loaded ${this.customRules.length} custom rules from DB`);
  }

  addRule(rule: PolicyRule): void {
    this.customRules.push(rule);
  }

  removeRule(id: string): void {
    this.customRules = this.customRules.filter((r) => r.id !== id);
    this.defaultRules = this.defaultRules.filter((r) => r.id !== id);
  }

  clearCustomRules(): void {
    this.customRules = [];
  }

  getRules(): PolicyRule[] {
    return [...this.customRules, ...this.defaultRules];
  }
}
