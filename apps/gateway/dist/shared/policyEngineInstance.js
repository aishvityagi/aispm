"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedPolicyEngine = void 0;
const policy_core_1 = require("@aispm/policy-core");
// Single shared instance used by both the plugin loader and proxy route
exports.sharedPolicyEngine = new policy_core_1.PolicyEngine();
//# sourceMappingURL=policyEngineInstance.js.map