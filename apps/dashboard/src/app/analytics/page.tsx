'use client'

import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import PageHeader from '../components/PageHeader'
import { fetchAuditEvents, AuditEvent } from '../lib/api'
import { buildCategoryData, buildUserStats, buildRiskHistogram } from '../lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const BAR_COLORS = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#f97316','#ec4899']

export default function AnalyticsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAuditEvents(500, 0).then(setEvents).catch(console.error).finally(() => setLoading(false))
  }, [])

  const categoryData  = buildCategoryData(events)
  const userStats     = buildUserStats(events)
  const histogramData = buildRiskHistogram(events)

  const tooltipStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: '8px', fontSize: '12px' }

  return (
    <DashboardShell>
      <PageHeader title="Analytics" subtitle="Threat intelligence, user behaviour, and risk distribution analysis" />

      {loading ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {[280, 300, 250].map((h, i) => <div key={i} className="skeleton" style={{ height: `${h}px` }} />)}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {/* Top Threat Categories */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>Top Threat Categories</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Detection frequency by category</div>
              {categoryData.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={100} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {categoryData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Risk Score Histogram */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>Risk Score Distribution</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Histogram of all risk scores</div>
              {events.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={histogramData} margin={{ left: -16, right: 8, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {histogramData.map((_, i) => {
                        const mid = (i + 1) * 10
                        return <Cell key={i} fill={mid > 70 ? '#ef4444' : mid > 40 ? '#f59e0b' : '#10b981'} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* User Stats */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Top Users by Request Volume</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Top 10 users ranked by total AI requests</div>
            </div>
            {userStats.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No user data available yet</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th style={{ width: '40px' }}>#</th><th>User ID</th><th>Total Requests</th><th>Avg Risk Score</th><th>Risk Profile</th></tr>
                </thead>
                <tbody>
                  {userStats.map((u, i) => (
                    <tr key={u.user_id}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: 'var(--accent-cyan)' }}>{u.user_id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, maxWidth: '120px', height: '4px', background: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min((u.count / (userStats[0]?.count || 1)) * 100, 100)}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: 'var(--text-primary)' }}>{u.count}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: u.avg_risk > 70 ? '#ef4444' : u.avg_risk > 40 ? '#f59e0b' : '#10b981' }}>
                          {u.avg_risk.toFixed(1)}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '4px', border: '1px solid',
                          ...(u.avg_risk > 70
                            ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }
                            : u.avg_risk > 40
                            ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }
                            : { background: 'rgba(16,185,129,0.1)', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }),
                        }}>
                          {u.avg_risk > 70 ? 'High Risk' : u.avg_risk > 40 ? 'Medium Risk' : 'Low Risk'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </DashboardShell>
  )
}

function Empty() {
  return <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No data yet</div>
}