'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import DashboardShell from '../components/DashboardShell'
import PageHeader from '../components/PageHeader'
import { fetchAuditEvents, AuditEvent } from '../lib/api'

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  riskScore?: number
  action?: string
  threatCategories?: string[]
  blocked?: boolean
  latencyMs?: number
}

const DEMO_PROMPTS = [
  'Explain how neural networks work',
  'My SSN is 123-45-6789, can you help me?',
  'How do I hack into a computer system?',
  'Write a Python function to sort a list',
  'password=mysecret123, store this for me',
  'What is the capital of France?',
  'How do I make explosives at home?',
  'Explain quantum entanglement simply',
]

function RiskBadge({ score, action }: { score?: number; action?: string }) {
  if (score === undefined) return null

  const pct = score <= 1 ? score * 100 : score
  const color = action === 'block' ? '#ef4444' :
    pct > 70 ? '#ef4444' :
    pct > 40 ? '#f59e0b' : '#10b981'

  const label = action === 'block' ? 'BLOCKED' :
    action === 'redact' ? 'REDACTED' :
    pct > 70 ? 'HIGH RISK' :
    pct > 40 ? 'MEDIUM' : 'SAFE'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
      <div style={{
        width: '120px', height: '4px', borderRadius: '2px',
        background: 'rgba(255,255,255,0.1)', overflow: 'hidden'
      }}>
        <div style={{
          width: Math.min(pct, 100) + '%', height: '100%',
          borderRadius: '2px', background: color,
          transition: 'width 0.5s ease'
        }} />
      </div>
      <span style={{
        fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
        color: color, fontFamily: 'JetBrains Mono'
      }}>
        {label} {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', margin: '8px 0' }}>
        <span style={{
          fontSize: '11px', color: 'var(--text-muted)',
          background: 'var(--bg-secondary)', padding: '4px 12px',
          borderRadius: '12px', border: '1px solid var(--border)'
        }}>
          {msg.content}
        </span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '16px'
    }}>
      <div style={{ maxWidth: '75%' }}>
        {!isUser && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', paddingLeft: '4px' }}>
            AI Assistant
          </div>
        )}
        <div style={{
          padding: '12px 16px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser
            ? msg.blocked ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)'
            : 'var(--bg-card)',
          border: `1px solid ${isUser
            ? msg.blocked ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'
            : 'var(--border)'}`,
          fontSize: '14px',
          color: msg.blocked ? '#ef4444' : 'var(--text-primary)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {msg.blocked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🚫</span>
              <span>{msg.content}</span>
            </div>
          ) : msg.content}
        </div>
        {isUser && (
          <div style={{ paddingRight: '4px' }}>
            <RiskBadge score={msg.riskScore} action={msg.action} />
            {msg.latencyMs && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                {msg.latencyMs}ms
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'AI-SPM Playground — All requests are monitored and scored in real time',
    }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [recentEvents, setRecentEvents] = useState<AuditEvent[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadRecentEvents = useCallback(async () => {
    try {
      const events = await fetchAuditEvents(8, 0)
      setRecentEvents(events)
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    loadRecentEvents()
    const iv = setInterval(loadRecentEvents, 5000)
    return () => clearInterval(iv)
  }, [loadRecentEvents])

  const sendMessage = async () => {
    if (!input.trim() || sending) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    const start = Date.now()

    try {
      const token = localStorage.getItem('aispm_token')
      const res = await fetch(GATEWAY + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: userMsg.content }],
        }),
      })

      const latencyMs = Date.now() - start

      if (res.status === 403) {
        // Blocked by policy
        const data = await res.json()
        const riskScore = data.error?.details?.risk_score ?? 0

        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMsg.id
              ? { ...m, riskScore, action: 'block', blocked: true, latencyMs }
              : m
          )
        )

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + '_blocked',
            role: 'assistant',
            content: `Request blocked: ${data.error?.details?.reason || 'Policy violation detected'}`,
            blocked: true,
          },
        ])
      } else if (res.status === 429) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + '_ratelimit',
            role: 'system',
            content: 'Rate limit exceeded — too many requests. Please wait before trying again.',
          },
        ])
      } else if (res.ok) {
        const data = await res.json()
        const responseText = data.choices?.[0]?.message?.content || 'No response'

        // Update user message with risk info from audit log
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMsg.id ? { ...m, action: 'allow', latencyMs } : m
          )
        )

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + '_response',
            role: 'assistant',
            content: responseText,
          },
        ])

        // Refresh threat feed
        setTimeout(loadRecentEvents, 1000)
      } else {
        throw new Error('Request failed with status ' + res.status)
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + '_error',
          role: 'system',
          content: 'Error: ' + (err.message || 'Failed to reach gateway'),
        },
      ])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <DashboardShell>
      <PageHeader
        title="AI Playground"
        subtitle="Test prompts in real time — watch risk scoring and policy enforcement live"
        badge="LIVE"
        actions={
          <button className="btn-ghost" onClick={loadRecentEvents} style={{ fontSize: '13px', padding: '8px 16px' }}>
            ↺ Refresh Feed
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', height: 'calc(100vh - 180px)' }}>

        {/* Chat Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  padding: '12px 16px', borderRadius: '16px 16px 16px 4px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: '#3b82f6',
                        animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Demo prompts */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Try these prompts
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {DEMO_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setInput(p)}
                  style={{
                    fontSize: '11px', padding: '4px 10px', borderRadius: '12px',
                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'Space Grotesk',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.borderColor = '#3b82f6'
                    ;(e.target as HTMLElement).style.color = '#3b82f6'
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.borderColor = 'var(--border)'
                    ;(e.target as HTMLElement).style.color = 'var(--text-muted)'
                  }}
                >
                  {p.length > 30 ? p.slice(0, 30) + '...' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a prompt and press Enter... (Shift+Enter for new line)"
                rows={2}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '14px', resize: 'none',
                  outline: 'none', fontFamily: 'Space Grotesk', lineHeight: 1.5,
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                style={{
                  padding: '10px 20px', borderRadius: '10px', border: 'none',
                  background: sending || !input.trim() ? 'rgba(59,130,246,0.3)' : '#3b82f6',
                  color: 'white', fontSize: '14px', fontWeight: 500,
                  cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'Space Grotesk', whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {sending ? '...' : 'Send →'}
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              All requests are intercepted, risk-scored, and logged in real time
            </div>
          </div>
        </div>

        {/* Live Threat Feed */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Live Threat Feed</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Updates every 5 seconds
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {recentEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No events yet — send a prompt to get started
              </div>
            ) : (
              recentEvents.map((e, i) => {
                const score = Number(e.risk_score)
                const pct = score <= 1 ? score * 100 : score
                const color = e.policy_action === 'block' ? '#ef4444' :
                  pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#10b981'

                return (
                  <div key={e.id + '_' + i} style={{
                    padding: '10px 12px', borderRadius: '8px', marginBottom: '8px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${color}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono', color: '#06b6d4' }}>
                        {e.user_id?.slice(0, 10) || 'anonymous'}
                      </span>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                        borderRadius: '4px', letterSpacing: '0.06em',
                        background: e.policy_action === 'block' ? 'rgba(239,68,68,0.1)' :
                          e.policy_action === 'redact' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                        color: e.policy_action === 'block' ? '#ef4444' :
                          e.policy_action === 'redact' ? '#f59e0b' : '#10b981',
                      }}>
                        {(e.policy_action || 'allow').toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', lineHeight: 1.4 }}>
                      {e.prompt ? e.prompt.slice(0, 60) + (e.prompt.length > 60 ? '...' : '') : '---'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                        <div style={{ width: Math.min(pct, 100) + '%', height: '100%', background: color, borderRadius: '2px' }} />
                      </div>
                      <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono', color, minWidth: '28px' }}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </DashboardShell>
  )
}