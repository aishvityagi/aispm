'use client'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  badge?: string
}

export default function PageHeader({ title, subtitle, actions, badge }: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            {title}
          </h1>
          {badge && (
            <span style={{
              fontSize: '11px', fontWeight: 500, color: 'var(--accent-blue)',
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              padding: '2px 8px', borderRadius: '99px', letterSpacing: '0.04em',
            }}>
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}