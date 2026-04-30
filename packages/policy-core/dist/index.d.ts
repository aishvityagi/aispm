import { InterceptedRequest, PolicyDecision, PolicyRule } from "@aispm/shared-types";
export declare const DEFAULT_RULES: PolicyRule[];
export declare class PolicyEngine {
    private defaultRules;
    private customRules;
    constructor(customRules?: PolicyRule[]);
    evaluate(request: InterceptedRequest): PolicyDecision;
    loadFromDB(rows: any[]): void;
    addRule(rule: PolicyRule): void;
    removeRule(id: string): void;
    clearCustomRules(): void;
    getRules(): PolicyRule[];
}
//# sourceMappingURL=index.d.ts.map