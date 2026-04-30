"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzePrompt = analyzePrompt;
const RISK_ENGINE_URL = process.env.RISK_ENGINE_URL || "http://localhost:8000";
const TIMEOUT_MS = 5000;
async function analyzePrompt(requestId, content, userId, sessionId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(`${RISK_ENGINE_URL}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: content,
                user_id: userId,
                session_id: sessionId,
            }),
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Risk engine returned ${response.status}: ${text}`);
        }
        const data = await response.json();
        const score = typeof data.risk_score === "number"
            ? data.risk_score
            : parseFloat(data.risk_score || "0");
        const threats = Array.isArray(data.threats)
            ? data.threats.map((t) => typeof t === "string" ? t : t.category).filter(Boolean)
            : [];
        return {
            score,
            threats,
            recommendation: data.recommendation || "allow",
            explanation: data.explanation || "",
        };
    }
    catch (err) {
        clearTimeout(timer);
        console.error("[riskEngine] Analysis failed, using safe default:", err);
        return {
            score: 0.0,
            threats: ["none"],
            recommendation: "allow",
            explanation: "Risk engine unavailable - unscored passthrough",
        };
    }
}
//# sourceMappingURL=riskEngine.js.map