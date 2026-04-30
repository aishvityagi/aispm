const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('aispm_token')
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return token
    ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
    : { 'Content-Type': 'application/json' }
}

export interface AuditEvent {
  id: string
  request_id: string
  user_id: string
  session_id: string
  prompt: string
  response: string
  model: string
  provider: string
  risk_score: number
  risk_level: string
  threat_categories: string[]
  policy_action: string
  matched_rule: string | null
  latency_ms: number
  tokens_used: number
  created_at: string
}

export interface AuditStats {
  total: number
  blocked: number
  redacted: number
  allowed: number
  avg_risk_score: number
}

export interface PolicyRule {
  id: string
  name: string
  condition_field: string
  operator: string
  value: string
  action: string
  created_at: string
}

export interface CreatePolicyPayload {
  name: string
  condition_field: string
  operator: string
  value: string
  action: string
}

function normalizeEvent(e: any): AuditEvent {
  const score = parseFloat(e.risk_score || e.risk || '0') || 0
  return {
    id: String(e.id ?? ''),
    request_id: e.request_id ?? '',
    user_id: e.user_id ?? 'anonymous',
    session_id: e.session_id ?? '',
    prompt: e.prompt ?? e.prompt_preview ?? '',
    response: e.response ?? e.response_preview ?? '',
    model: e.model ?? '',
    provider: e.provider ?? 'groq',
    risk_score: score,
    risk_level: e.risk_level ?? (
  score > 0.75 ? 'critical' :
  score > 0.50 ? 'high' :
  score > 0.25 ? 'medium' :
  score > 0 ? 'low' : 'safe'
),
    threat_categories: Array.isArray(e.threat_categories)
      ? e.threat_categories
      : Array.isArray(e.threats)
      ? e.threats
      : typeof e.threat_categories === 'string'
      ? JSON.parse(e.threat_categories || '[]')
      : [],
    policy_action: e.policy_action ?? 'allow',
    matched_rule: e.matched_rule ?? e.rule_triggered ?? null,
    latency_ms: e.latency_ms ?? 0,
    tokens_used: e.tokens_used ?? 0,
    created_at: e.created_at ?? e.timestamp ?? new Date().toISOString(),
  }
}

function normalizeStats(data: any): AuditStats {
  const src = (data && typeof data.total !== 'undefined') ? data : (data?.data ?? {})
  return {
    total: Number(src.total ?? 0),
    blocked: Number(src.blocked ?? 0),
    redacted: Number(src.redacted ?? 0),
    allowed: Number(src.allowed ?? 0),
    avg_risk_score: parseFloat(src.avg_risk_score ?? src.avgRiskScore ?? '0') || 0,
  }
}

export async function fetchAuditEvents(limit = 20, offset = 0): Promise<AuditEvent[]> {
  try {
    const res = await fetch(GATEWAY + '/v1/audit/events?limit=' + limit + '&offset=' + offset, {
      headers: authHeaders(),
    })
    if (!res.ok) return []
    const data = await res.json()
    const arr = Array.isArray(data) ? data
      : Array.isArray(data.events) ? data.events
      : Array.isArray(data.data) ? data.data
      : Array.isArray(data.results) ? data.results
      : []
    return arr.map(normalizeEvent)
  } catch {
    return []
  }
}

export async function fetchAuditStats(): Promise<AuditStats> {
  try {
    const res = await fetch(GATEWAY + '/v1/audit/stats', {
      headers: authHeaders(),
    })
    if (!res.ok) return { total: 0, blocked: 0, redacted: 0, allowed: 0, avg_risk_score: 0 }
    const data = await res.json()
    return normalizeStats(data)
  } catch {
    return { total: 0, blocked: 0, redacted: 0, allowed: 0, avg_risk_score: 0 }
  }
}

export async function fetchPolicies(): Promise<PolicyRule[]> {
  try {
    const res = await fetch(GATEWAY + '/v1/policies', {
      headers: authHeaders(),
    })
    if (!res.ok) return []
    const data = await res.json()
    const arr = Array.isArray(data) ? data
      : Array.isArray(data.rules) ? data.rules
      : Array.isArray(data.data) ? data.data
      : Array.isArray(data.policies) ? data.policies
      : []
    return arr
  } catch {
    return []
  }
}

export async function createPolicy(payload: CreatePolicyPayload): Promise<PolicyRule> {
  const res = await fetch(GATEWAY + '/v1/policies', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to create policy')
  return res.json()
}

export async function deletePolicy(id: string): Promise<void> {
  const res = await fetch(GATEWAY + '/v1/policies/' + id, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete policy')
}

