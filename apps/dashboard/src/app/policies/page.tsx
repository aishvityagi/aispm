'use client'

import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import PageHeader from '../components/PageHeader'
import { fetchPolicies, createPolicy, deletePolicy, PolicyRule, CreatePolicyPayload } from '../lib/api'

const FIELDS    = ['prompt', 'response', 'user_id', 'model', 'risk_score', 'threat_category']
const OPERATORS = ['contains', 'not_contains', 'equals', 'not_equals', 'greater_than', 'less_than', 'regex']
const ACTIONS   = ['block', 'redact', 'allow', 'flag']
const BLANK: CreatePolicyPayload = { name: '', condition_field: 'prompt', operator: 'contains', value: '', action: 'block' }

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRule[]>([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState<CreatePolicyPayload>(BLANK)
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    try { setPolicies(await fetchPolicies()) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.value.trim()) { setError('Name and Value are required'); return }
    setCreating(true); setError('')
    try {
      await createPolicy(form)
      setSuccess('Policy created successfully')
      setForm(BLANK); setShowForm(false)
      await load()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) { setError(e.message) }
    finally { setCreating(false) }
  }

  async function handleDelete(id: string) {
    try {
      await deletePolicy(id)
      setDeleteId(null); setSuccess('Policy deleted')
      await load()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) { setError(e.message) }
  }

  const actionStyle = (a: string): React.CSSProperties => ({
    block:  { background: 'rgba(239,68,68,0.1)',  color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' },
    redact: { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' },
    allow:  { background: 'rgba(16,185,129,0.1)', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' },
    flag:   { background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', borderColor: 'rgba(139,92,246,0.3)' },
  }[a] || { background: 'rgba(107,114,128,0.1)', color: '#6b7280', borderColor: 'rgba(107,114,128,0.3)' })

  return (
    <DashboardShell>
      <PageHeader
        title="Policy Management"
        subtitle="Define and manage security rules for AI request interception and enforcement"
        actions={<button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? '✕ Cancel' : '+ New Policy'}</button>}
      />

      {success && (
        <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: '14px' }}>
          ✓ {success}
        </div>
      )}
      {error && (
        <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '14px' }}>
          ✕ {error}
        </div>
      )}

      {showForm && (
        <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '20px' }}>Create New Policy Rule</div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {[
                { label: 'Rule Name *', key: 'name', type: 'input', placeholder: 'e.g. Block PII Requests' },
              ].map((f) => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</label>
                  <input className="input-field" placeholder={f.placeholder} value={(form as any)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action *</label>
                <select className="input-field" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                  {ACTIONS.map((a) => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Condition Field</label>
                <select className="input-field" value={form.condition_field} onChange={(e) => setForm({ ...form, condition_field: e.target.value })}>
                  {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Operator</label>
                <select className="input-field" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })}>
                  {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Value *</label>
                <input className="input-field" placeholder={form.operator === 'regex' ? 'e.g. \\b(ssn|password)\\b' : 'e.g. password, credit card'} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
            </div>
            {/* Live preview */}
            <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: '20px', fontSize: '13px', fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-muted)' }}>IF </span>
              <span style={{ color: 'var(--accent-cyan)' }}>{form.condition_field}</span>
              <span style={{ color: 'var(--text-muted)' }}> {form.operator} </span>
              <span style={{ color: 'var(--accent-blue)' }}>"{form.value || '…'}"</span>
              <span style={{ color: 'var(--text-muted)' }}> → </span>
              <span style={{ color: form.action === 'block' ? '#ef4444' : form.action === 'redact' ? '#f59e0b' : form.action === 'allow' ? '#10b981' : '#8b5cf6', fontWeight: 500, textTransform: 'uppercase' }}>{form.action}</span>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn-primary" disabled={creating}>{creating ? 'Creating…' : 'Create Policy'}</button>
              <button type="button" className="btn-ghost" onClick={() => { setForm(BLANK); setShowForm(false) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Active Policy Rules</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{policies.length} rules enforced</div>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Rule Name</th><th>Condition</th><th>Operator</th><th>Value</th><th>Action</th><th>Created</th><th style={{ width: '120px' }}></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading…</td></tr>}
            {!loading && policies.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No policies yet</td></tr>}
            {policies.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '13px' }}>{p.name}</td>
                <td style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: 'var(--accent-cyan)' }}>{p.condition_field}</td>
                <td style={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>{p.operator}</td>
                <td>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', maxWidth: '180px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.value}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '4px', border: '1px solid', textTransform: 'uppercase', letterSpacing: '0.06em', ...actionStyle(p.action) }}>
                    {p.action}
                  </span>
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                <td>
                  {deleteId === p.id ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn-danger" onClick={() => handleDelete(p.id)} style={{ padding: '4px 10px', fontSize: '12px' }}>Confirm</button>
                      <button className="btn-ghost" onClick={() => setDeleteId(null)} style={{ padding: '4px 10px', fontSize: '12px' }}>No</button>
                    </div>
                  ) : (
                    <button className="btn-danger" onClick={() => setDeleteId(p.id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  )
}