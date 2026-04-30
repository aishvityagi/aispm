export function getRiskClass(level: string): string {
  switch (level?.toLowerCase()) {
    case 'critical': return 'risk-critical'
    case 'high':     return 'risk-high'
    case 'medium':   return 'risk-medium'
    case 'low':      return 'risk-low'
    default:         return 'risk-safe'
  }
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function truncate(str: string, n: number): string {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

export function buildTimeSeriesFromEvents(events: any[]): Array<{ time: string; requests: number; blocked: number }> {
  const now = Date.now()
  const buckets: Record<string, { requests: number; blocked: number }> = {}

  for (let i = 23; i >= 0; i--) {
    const t = new Date(now - i * 3600 * 1000)
    const key = `${t.getHours().toString().padStart(2, '0')}:00`
    buckets[key] = { requests: 0, blocked: 0 }
  }

  events.forEach((e) => {
    const d = new Date(e.created_at)
    const key = `${d.getHours().toString().padStart(2, '0')}:00`
    if (buckets[key]) {
      buckets[key].requests++
      if (e.policy_action === 'block') buckets[key].blocked++
    }
  })

  return Object.entries(buckets).map(([time, v]) => ({ time, ...v }))
}

export function buildCategoryData(events: any[]): Array<{ name: string; value: number }> {
  const counts: Record<string, number> = {}
  events.forEach((e) => {
    const cats: string[] = Array.isArray(e.threat_categories)
      ? e.threat_categories
      : (typeof e.threat_categories === 'string' ? JSON.parse(e.threat_categories || '[]') : [])
    cats.forEach((c: string) => { counts[c] = (counts[c] || 0) + 1 })
  })
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

export function buildUserStats(events: any[]): Array<{ user_id: string; count: number; avg_risk: number }> {
  const map: Record<string, { count: number; total_risk: number }> = {}
  events.forEach((e) => {
    if (!map[e.user_id]) map[e.user_id] = { count: 0, total_risk: 0 }
    map[e.user_id].count++
    map[e.user_id].total_risk += Number(e.risk_score) || 0
  })
  return Object.entries(map)
    .map(([user_id, v]) => ({
      user_id,
      count: v.count,
      avg_risk: v.count > 0 ? Math.round((v.total_risk / v.count) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export function buildRiskHistogram(events: any[]): Array<{ range: string; count: number }> {
  const buckets = [
    { range: '0–10',   min: 0,  max: 10,  count: 0 },
    { range: '10–20',  min: 10, max: 20,  count: 0 },
    { range: '20–30',  min: 20, max: 30,  count: 0 },
    { range: '30–40',  min: 30, max: 40,  count: 0 },
    { range: '40–50',  min: 40, max: 50,  count: 0 },
    { range: '50–60',  min: 50, max: 60,  count: 0 },
    { range: '60–70',  min: 60, max: 70,  count: 0 },
    { range: '70–80',  min: 70, max: 80,  count: 0 },
    { range: '80–90',  min: 80, max: 90,  count: 0 },
    { range: '90–100', min: 90, max: 101, count: 0 },
  ]
  events.forEach((e) => {
    const score = (Number(e.risk_score) || 0) * 100
    const b = buckets.find((b) => score >= b.min && score < b.max)
    if (b) b.count++
  })
  return buckets.map(({ range, count }) => ({ range, count }))
}