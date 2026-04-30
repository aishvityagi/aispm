'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardShell from '../components/DashboardShell'
import PageHeader from '../components/PageHeader'
import { fetchAuditEvents, AuditEvent } from '../lib/api'
import { getRiskClass, formatDate, truncate } from '../lib/utils'

const PAGE_SIZE = 20

function parseCats(cats: any): string[] {
  if (Array.isArray(cats)) return cats.filter((c: string) => c && c !== 'none')
  if (typeof cats === 'string') { try { return JSON.parse(cats) } catch { return [] } }
  return []
}

export default function ThreatsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
const [searchResults, setSearchResults] = useState<AuditEvent[] | null>(null)
const [searching, setSearching] = useState(false)

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    try {
      const data = await fetchAuditEvents(PAGE_SIZE, off)
      setEvents((prev) => off === 0 ? data : [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load(0)
    const iv = setInterval(() => load(0), 15000)
    return () => clearInterval(iv)
  }, [load])

  const filtered = filter === 'all' ? events : events.filter((e) => e.policy_action?.toLowerCase() === filter)
  const handleSearch = async (ev: React.FormEvent) => {
  ev.preventDefault()
  if (!searchQuery.trim()) { setSearchResults(null); return }
  setSearching(true)
  try {
    const token = localStorage.getItem('aispm_token')
    const res = await fetch(
      `http://localhost:3000/v1/search?q=${encodeURIComponent(searchQuery)}&limit=20`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    setSearchResults(data.results || [])
  } catch (err) {
    console.error('Search failed:', err)
  } finally {
    setSearching(false)
  }
}

  return (
    <DashboardShell>
      <PageHeader
        title="Threat Feed"
        subtitle="Live stream of intercepted AI requests and policy enforcement actions"
        badge="LIVE"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'block', 'redact', 'allow'].map((f) => {
              const active = filter === f
              const activeColor = f === 'block' ? '#ef4444' : f === 'redact' ? '#f59e0b' : f === 'allow' ? '#10b981' : '#3b82f6'
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '6px 14px', borderRadius: '6px', border: '1px solid', fontSize: '12px',
                  fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'Space Grotesk',
                  background: active ? activeColor + '22' : 'transparent',
                  color: active ? activeColor : 'var(--text-muted)',
                  borderColor: active ? activeColor + '66' : 'var(--border)',
                }}>
                  {f}
                </button>
              )
            })}
          </div>
        }
      />
<form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
  <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder="Search prompts, responses, threat categories..."
    style={{
      flex: 1, padding: '10px 16px', borderRadius: '8px',
      border: '1px solid var(--border)', background: 'var(--bg-card)',
      color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
      fontFamily: 'Space Grotesk',
    }}
  />
  <button type="submit" disabled={searching} style={{
    padding: '10px 20px', borderRadius: '8px', border: 'none',
    background: '#3b82f6', color: 'white', fontSize: '13px',
    fontWeight: 500, cursor: 'pointer', opacity: searching ? 0.6 : 1,
    fontFamily: 'Space Grotesk',
  }}>
    {searching ? 'Searching...' : 'Search'}
  </button>
  {searchResults !== null && (
    <button type="button" onClick={() => { setSearchResults(null); setSearchQuery('') }} style={{
      padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)',
      background: 'transparent', color: 'var(--text-muted)', fontSize: '13px',
      cursor: 'pointer', fontFamily: 'Space Grotesk',
    }}>
      Clear
    </button>
  )}
</form>

{searchResults !== null && (
  <div className="card" style={{ overflow: 'hidden', marginBottom: '16px' }}>
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for{' '}
        <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>"{searchQuery}"</span>
      </span>
    </div>
    {searchResults.length === 0 ? (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No results found
      </div>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Prompt</th>
              <th style={{ width: '100px' }}>Risk Score</th>
              <th style={{ width: '90px' }}>Action</th>
              <th style={{ width: '160px' }}>Category</th>
            </tr>
          </thead>
          <tbody>
            {searchResults.map((r: any, i: number) => (
              <tr key={i}>
                <td style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: '#06b6d4' }}>
                  {r.user_id?.slice(0, 8) || '---'}
                </td>
                <td style={{ fontSize: '13px' }}>{r.prompt ? r.prompt.slice(0, 80) : '---'}</td>
                <td>
                  <span style={{
                    fontFamily: 'JetBrains Mono', fontSize: '12px',
                    color: Number(r.risk_score) > 0.70 ? '#ef4444' : Number(r.risk_score) > 0.40 ? '#f59e0b' : '#10b981'
                  }}>
                    {r.risk_score ? (Number(r.risk_score) * 100).toFixed(0) : '---'}
                  </span>
                </td>
                <td><ActionChip action={r.action_taken} /></td>
                <td>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                    {r.threat_category || 'none'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Time</th>
                <th style={{ width: '100px' }}>User</th>
                <th>Prompt</th>
                <th style={{ width: '120px' }}>Risk Score</th>
                <th style={{ width: '90px' }}>Level</th>
                <th style={{ width: '90px' }}>Action</th>
                <th style={{ width: '160px' }}>Categories</th>
                <th style={{ width: '80px' }}>Latency</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={'exp-' + e.id + '-' + e.created_at}>
                  {expanded === e.id ? (
                    <td colSpan={8} style={{ padding: 0, border: 'none' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr onClick={() => setExpanded(null)} style={{ cursor: 'pointer', background: 'rgba(59,130,246,0.04)' }}>
                            <MainRow e={e} />
                          </tr>
                          <tr>
                            <td colSpan={8} style={{ background: 'rgba(59,130,246,0.04)', borderLeft: '3px solid var(--accent-blue)', padding: '20px 24px' }}>
                              <ExpandedRow event={e} />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  ) : (
                    <MainRow e={e} onExpand={() => setExpanded(e.id)} />
                  )}
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr key="empty">
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    No events found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</span>
          </div>
        )}
        {hasMore && !loading && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <button className="btn-ghost" onClick={() => { const n = offset + PAGE_SIZE; setOffset(n); load(n) }} style={{ fontSize: '13px' }}>
              Load more
            </button>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}

function MainRow({ e, onExpand }: { e: AuditEvent; onExpand?: () => void }) {
  const cats = parseCats(e.threat_categories)
  return (
    <>
      <td onClick={onExpand} style={{ fontSize: '12px', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>{formatDate(e.created_at)}</td>
      <td onClick={onExpand} style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: 'var(--accent-cyan)', cursor: 'pointer' }}>{e.user_id ? e.user_id.slice(0, 8) : '---'}</td>
      <td onClick={onExpand} style={{ cursor: 'pointer' }}><span style={{ fontSize: '13px' }}>{truncate(e.prompt, 80)}</span></td>
      <td onClick={onExpand} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            <div style={{ width: Math.min(Number(e.risk_score) * 100, 100) + '%', height: '100%', borderRadius: '2px', background: Number(e.risk_score) > 0.70 ? '#ef4444' : Number(e.risk_score) > 0.40 ? '#f59e0b' : '#10b981' }} />
          </div>
          <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono', color: Number(e.risk_score) > 70 ? '#ef4444' : Number(e.risk_score) > 40 ? '#f59e0b' : '#10b981', minWidth: '28px' }}>
            {(Number(e.risk_score) * (Number(e.risk_score) <= 1 ? 100 : 1)).toFixed(0)}
          </span>
        </div>
      </td>
      <td onClick={onExpand} style={{ cursor: 'pointer' }}>
        <span className={getRiskClass(e.risk_level)} style={{ fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '4px', border: '1px solid', textTransform: 'capitalize' }}>
          {e.risk_level || 'safe'}
        </span>
      </td>
      <td onClick={onExpand} style={{ cursor: 'pointer' }}><ActionChip action={e.policy_action} /></td>
      <td onClick={onExpand} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
          {cats.slice(0, 2).map((c, i) => (
            <span key={i} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)', whiteSpace: 'nowrap' }}>
              {c}
            </span>
          ))}
          {cats.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>none</span>}
          {cats.length > 2 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{cats.length - 2}</span>}
        </div>
      </td>
      <td style={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>{e.latency_ms ? e.latency_ms + 'ms' : '---'}</td>
    </>
  )
}

function ActionChip({ action }: { action: string }) {
  const s: Record<string, React.CSSProperties> = {
    block:  { background: 'rgba(239,68,68,0.1)',  color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' },
    redact: { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' },
    allow:  { background: 'rgba(16,185,129,0.1)', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' },
  }
  const style = s[action?.toLowerCase()] || { background: 'rgba(107,114,128,0.1)', color: '#6b7280', borderColor: 'rgba(107,114,128,0.3)' }
  return (
    <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '4px', border: '1px solid', textTransform: 'uppercase', letterSpacing: '0.06em', ...style }}>
      {action || '---'}
    </span>
  )
}

function ExpandedRow({ event: e }: { event: AuditEvent }) {
  const box: React.CSSProperties = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px',
    padding: '12px', fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono',
    lineHeight: 1.6, maxHeight: '160px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Full Prompt</div>
        <div style={box}>{e.prompt || 'N/A'}</div>
      </div>
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Response</div>
        <div style={{ ...box, color: 'var(--text-secondary)' }}>{e.response || 'N/A'}</div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Request ID', value: e.request_id, mono: true },
          { label: 'Session',    value: e.session_id,  mono: true },
          { label: 'Model',      value: e.model,        mono: false },
          { label: 'Provider',   value: e.provider,     mono: false },
          { label: 'Tokens',     value: String(e.tokens_used ?? '---') },
          { label: 'Matched Rule', value: e.matched_rule || 'None' },
        ].map((m) => (
          <div key={m.label}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>{m.label}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: m.mono ? 'JetBrains Mono' : 'Space Grotesk' }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
