"use strict";
// apps/gateway/src/consumers/alertConsumer.ts
// Watches ai.policy.violations and ai.anomalies.detected Kafka topics
// Sends Slack webhook messages for blocked requests, critical risk scores, anomalies
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const kafkajs_1 = require("kafkajs");
const node_fetch_1 = __importDefault(require("node-fetch"));
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:29092';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const kafka = new kafkajs_1.Kafka({
    clientId: 'alert-consumer',
    brokers: [KAFKA_BROKER],
});
const consumer = kafka.consumer({ groupId: 'alert-group' });
// Build a Slack message block from event data
function buildSlackMessage(eventType, data) {
    const riskScore = data.risk_score ?? data.riskScore ?? 'N/A';
    const userId = data.user_id ?? data.userId ?? 'unknown';
    const category = data.threat_category ?? data.category ?? data.anomaly_type ?? 'unknown';
    const prompt = data.prompt ?? data.message ?? '';
    const promptPreview = typeof prompt === 'string' ? prompt.slice(0, 100) : '';
    const timestamp = data.timestamp ?? new Date().toISOString();
    // Choose emoji based on type
    const icon = eventType === 'violation' ? '🚫' : '⚠️';
    const title = eventType === 'violation' ? 'Policy Violation — Request Blocked' : 'Anomaly Detected';
    return {
        text: `${icon} *AI-SPM Alert: ${title}*`,
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `${icon} AI-SPM Alert: ${title}`,
                    emoji: true,
                },
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Threat Category:*\n${category}` },
                    { type: 'mrkdwn', text: `*Risk Score:*\n${riskScore}` },
                    { type: 'mrkdwn', text: `*User ID:*\n${userId}` },
                    { type: 'mrkdwn', text: `*Timestamp:*\n${timestamp}` },
                ],
            },
            promptPreview
                ? {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*Prompt Preview:*\n\`\`\`${promptPreview}\`\`\``,
                    },
                }
                : null,
            {
                type: 'divider',
            },
        ].filter(Boolean),
    };
}
async function sendSlackAlert(eventType, data) {
    if (!SLACK_WEBHOOK_URL || SLACK_WEBHOOK_URL.includes('YOUR/WEBHOOK')) {
        console.warn('[AlertConsumer] SLACK_WEBHOOK_URL not configured — skipping Slack alert');
        return;
    }
    const message = buildSlackMessage(eventType, data);
    try {
        const res = await (0, node_fetch_1.default)(SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message),
        });
        if (res.ok) {
            console.log(`[AlertConsumer] Slack alert sent for ${eventType}`);
        }
        else {
            const body = await res.text();
            console.error(`[AlertConsumer] Slack returned ${res.status}: ${body}`);
        }
    }
    catch (err) {
        console.error('[AlertConsumer] Failed to send Slack alert:', err);
    }
}
async function processMessage({ topic, message }) {
    if (!message.value)
        return;
    let data;
    try {
        data = JSON.parse(message.value.toString());
    }
    catch {
        console.warn('[AlertConsumer] Could not parse message as JSON');
        return;
    }
    console.log(`[AlertConsumer] Received message on ${topic}`);
    if (topic === 'ai.policy.violations') {
        // Always alert on policy violations (request blocked)
        await sendSlackAlert('violation', data);
    }
    else if (topic === 'ai.anomalies.detected') {
        // Alert on anomalies — also alert separately if risk score is critical (>0.85)
        await sendSlackAlert('anomaly', data);
        const riskScore = parseFloat(data.risk_score ?? data.riskScore ?? '0');
        if (riskScore > 0.85) {
            // Send a second, higher-urgency alert specifically for critical risk
            await sendSlackAlert('critical_risk', { ...data, _critical: true });
        }
    }
}
async function run() {
    console.log('[AlertConsumer] Connecting to Kafka...');
    await consumer.connect();
    await consumer.subscribe({
        topics: ['ai.policy.violations', 'ai.anomalies.detected'],
        fromBeginning: false,
    });
    console.log('[AlertConsumer] Subscribed to ai.policy.violations and ai.anomalies.detected');
    await consumer.run({
        eachMessage: processMessage,
    });
}
// Handle graceful shutdown
const shutdown = async () => {
    console.log('[AlertConsumer] Shutting down...');
    await consumer.disconnect();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
run().catch((err) => {
    console.error('[AlertConsumer] Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=alertConsumer.js.map