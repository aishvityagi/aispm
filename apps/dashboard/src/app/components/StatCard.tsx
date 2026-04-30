'use client'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon: React.ReactNode
  trend?: number
}

export default function StatCard({ label, value, sub, color = '#3b82f6', icon, trend }: StatCardProps) {
  return (
    <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, ${color}, transparent)`,
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '8px',
          background: `${color}18`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color,
        }}>
          {icon}
        </div>
        {trend !== undefined && (
          <span style={{
            fontSize: '12px',
            color: trend >= 0 ? '#10b981' : '#ef4444',
            background: trend >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            padding: '2px 8px', borderRadius: '99px',
          }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>{label}</div>
      {sub && <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}