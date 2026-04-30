import { PolicyEngine } from "@aispm/policy-core";

// Single shared instance used by both the plugin loader and proxy route
export const sharedPolicyEngine = new PolicyEngine();
