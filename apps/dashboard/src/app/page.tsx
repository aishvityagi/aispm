'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardShell from './components/DashboardShell'
import StatCard from './components/StatCard'
import PageHeader from './components/PageHeader'
import { fetchAuditStats, fetchAuditEvents, AuditStats, AuditEvent } from './lib/api'
import { buildTimeSeriesFromEvents, formatNumber } from './lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444']

export default function OverviewPage() {
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(30)
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  const load = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([fetchAuditStats(), fetchAuditEvents(200, 0)])
      setStats(s)
      setEvents(e)
      setLastRefresh(Date.now())
      setCountdown(30)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 30)), 1000)
    return () => clearInterval(t)
  }, [lastRefresh])

  const timeSeries = buildTimeSeriesFromEvents(events)
  const pieData = stats
    ? [
        { name: 'Allowed',  value: stats.allowed },
        { name: 'Redacted', value: stats.redacted },
        { name: 'Blocked',  value: stats.blocked },
      ]
    : []

  return (
    <DashboardShell>
      <PageHeader
        title="Security Overview"
        subtitle="Real-time monitoring of AI request activity and threat posture"
        badge="LIVE"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Refreshes in{' '}
              <span style={{ color: 'var(--accent-blue)', fontFamily: 'JetBrains Mono' }}>{countdown}s</span>
            </span>
            <button className="btn-ghost" onClick={load} style={{ padding: '8px 16px', fontSize: '13px' }}>
              Refresh
            </button>
          </div>
        }
      />

      {loading ? <SkeletonLoader /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <StatCard label="Total Requests" value={formatNumber(stats?.total ?? 0)} color="#3b82f6"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            />
            <StatCard label="Blocked" value={formatNumber(stats?.blocked ?? 0)}
              sub={stats ? ((stats.blocked / (stats.total || 1)) * 100).toFixed(1) + '% of total' : ''}
              color="#ef4444"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>}
            />
            <StatCard label="Redacted" value={formatNumber(stats?.redacted ?? 0)}
              sub={stats ? ((stats.redacted / (stats.total || 1)) * 100).toFixed(1) + '% of total' : ''}
              color="#f59e0b"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
            />
            <StatCard label="Allowed" value={formatNumber(stats?.allowed ?? 0)}
              sub={stats ? ((stats.allowed / (stats.total || 1)) * 100).toFixed(1) + '% of total' : ''}
              color="#10b981"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
            />
            <StatCard label="Avg Risk Score" value={((stats?.avg_risk_score ?? 0) * 100).toFixed(1)} 
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Requests Over Time</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Last 24 hours</div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Requests</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Blocked</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeSeries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#4a5a7a' }} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: '#4a5a7a' }} />
                  <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #2a3f66', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: '#f0f4ff' }} />
                  <Line type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="blocked" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>Policy Actions</div>
              <div style={{ fontSize: '12px', color: '#4a5a7a', marginBottom: '16px' }}>Breakdown by action type</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #2a3f66', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: '12px', color: '#8899bb' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #1e2d4a' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Recent Events</div>
              <div style={{ fontSize: '12px', color: '#4a5a7a', marginTop: '2px' }}>Latest 10 intercepted requests</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Prompt Preview</th>
                    <th>Risk</th>
                    <th>Action</th>
                    <th>Latency</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, 10).map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: '#06b6d4' }}>
                        {e.user_id ? e.user_id.slice(0, 8) : '---'}
                      </td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.prompt ? e.prompt.slice(0, 60) : '---'}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: Number(e.risk_score) > 0.70 ? '#ef4444' : Number(e.risk_score) > 0.40 ? '#f59e0b' : '#10b981' }}>
                          {(Number(e.risk_score) * 100).toFixed(0)}
                        </span>
                      </td>
                      <td><ActionBadge action={e.policy_action} /></td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>
                        {e.latency_ms ? e.latency_ms + 'ms' : '---'}
                      </td>
                      <td style={{ fontSize: '12px', color: '#4a5a7a', whiteSpace: 'nowrap' }}>
                        {new Date(e.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#4a5a7a' }}>
                        No events yet - make some requests through the gateway
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  )
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    block:  { bg: 'rgba(239,68,68,0.1)',  text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
    redact: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    allow:  { bg: 'rgba(16,185,129,0.1)', text: '#10b981', border: 'rgba(16,185,129,0.3)' },
  }
  const c = colors[action ? action.toLowerCase() : ''] || { bg: 'rgba(107,114,128,0.1)', text: '#6b7280', border: 'rgba(107,114,128,0.3)' }
  return (
    <span style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', background: c.bg, color: c.text, border: '1px solid ' + c.border }}>
      {action || '---'}
    </span>
  )
}

function SkeletonLoader() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="skeleton" style={{ height: '120px' }} />
        <div className="skeleton" style={{ height: '120px' }} />
        <div className="skeleton" style={{ height: '120px' }} />
        <div className="skeleton" style={{ height: '120px' }} />
        <div className="skeleton" style={{ height: '120px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '24px' }}>
        <div className="skeleton" style={{ height: '300px' }} />
        <div className="skeleton" style={{ height: '300px' }} />
      </div>
      <div className="skeleton" style={{ height: '300px' }} />
    </div>
  )
}