'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import type { ChatMessage, QueryResult, SMEProfile } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export default function UserChat({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uuidv4(),
      role: 'assistant',
      content: "Hello! I'm Thoth, your knowledge assistant. Ask me anything and I'll either answer from our knowledge base or connect you with the right expert.",
      timestamp: new Date().toISOString()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input, session_id: sessionId })
      })

      const data = await res.json()
      const result: QueryResult = data.result

      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: formatResponse(result),
        timestamp: new Date().toISOString(),
        metadata: {
          action: result.action,
          routed_sme: result.routed_sme,
          confidence: result.confidence_score,
          sources: result.sources as any
        }
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString()
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 20px', background: '#F6F6F6' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative' }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask anything about GIX, Career Services, CPT, OPT…"
            style={{
              width: '100%',
              paddingLeft: 22,
              paddingRight: 64,
              paddingTop: 15,
              paddingBottom: 15,
              border: '1px solid var(--border-strong)',
              borderRadius: 999,
              fontSize: 16,
              color: 'var(--text-1)',
              outline: 'none',
              background: 'white',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              transition: 'border-color 0.15s, box-shadow 0.15s'
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--tm-magenta)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(226,0,116,0.12)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border-strong)'
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: loading || !input.trim() ? 'var(--border-strong)' : 'var(--tm-magenta)',
              border: 'none',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Message Bubble
// ============================================
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const action = message.metadata?.action
  const sme = message.metadata?.routed_sme
  const sources = message.metadata?.sources as any[]

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '80%', minWidth: 0 }}>
        {/* Sender label */}
        {!isUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div style={{ width: 24, height: 24, background: 'var(--tm-magenta)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: 12 }}>T</div>
            <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>Thoth</span>
            {action && <ActionBadge action={action} />}
          </div>
        )}

        {/* Bubble */}
        <div style={{
          padding: '13px 18px',
          fontSize: 16,
          lineHeight: 1.65,
          ...(isUser
            ? {
                background: 'var(--tm-magenta)',
                color: 'white',
                borderRadius: '20px 20px 4px 20px',
              }
            : {
                background: '#F3F3F3',
                color: '#191919',
                borderRadius: '20px 20px 20px 4px',
              }
          )
        }}>
          {message.content}
        </div>

        {/* === answer: card-style sources list === */}
        {action === 'answered' && sources && sources.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8 }}>Sources</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sources.map((s: any, i: number) => (
                <div
                  key={s.topic_tag || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: '10px 14px',
                    cursor: 'default',
                    transition: 'border-color 0.15s'
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--tm-magenta)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
                >
                  <span style={{ fontSize: 14, color: '#191919', fontWeight: 500 }}>
                    {s.topic_tag || s}{s.sme_name ? ` · ${s.sme_name}` : ''}
                  </span>
                  <span style={{ color: 'var(--tm-magenta)', fontWeight: 700, fontSize: 14 }}>→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === sme_redirect: expert card with Sparkle === */}
        {action === 'routed_sme' && sme && (
          <div style={{ marginTop: 10, background: 'white', border: '1px solid var(--border)', borderRadius: 24, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Sparkles size={14} color="var(--tm-magenta)" fill="var(--tm-magenta)" />
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tm-magenta)' }}>Routed to Expert</p>
            </div>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#000000', marginBottom: 4 }}>{sme.full_name}</p>
            {sme.title && <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 12 }}>{sme.title}</p>}
            {sme.email && (
              <a
                href={`mailto:${sme.email}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '9px 20px',
                  borderRadius: 999,
                  background: 'var(--tm-magenta)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'background 0.15s'
                }}
              >
                Contact via Email
              </a>
            )}
          </div>
        )}

        {/* === admin_fallback: quiet ink-50 card === */}
        {action === 'routed_admin' && (
          <div style={{ marginTop: 10, background: '#F6F6F6', border: '1px solid var(--border)', borderRadius: 24, padding: '16px 20px' }}>
            <p style={{ fontSize: 14, color: '#191919', lineHeight: 1.6 }}>
              This question is outside what our SMEs currently cover. We have logged it for the admin team.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, fontFamily: "'SF Mono', Monaco, monospace" }}>Logged for review</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Action Badge
// ============================================
function ActionBadge({ action }: { action: string }) {
  const config: Record<string, { label: string; bg: string; color: string }> = {
    answered:     { label: 'From KB',         bg: '#F0FDF4', color: '#15803D' },
    clarified:    { label: 'Clarifying',      bg: '#FEFCE8', color: '#92600A' },
    routed_sme:   { label: 'Routing to SME',  bg: '#EEF2FF', color: '#3730A3' },
    routed_admin: { label: 'Escalated',       bg: '#FFF7ED', color: '#9A3412' },
  }
  const c = config[action] || { label: action, bg: '#F3F3F3', color: 'var(--text-2)' }

  return (
    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: c.bg, color: c.color, fontWeight: 600 }}>
      {c.label}
    </span>
  )
}

// ============================================
// Typing indicator
// ============================================
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 24, height: 24, background: 'var(--tm-magenta)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: 12 }}>T</div>
      <div style={{ background: '#F3F3F3', borderRadius: '20px 20px 20px 4px', padding: '12px 18px', display: 'flex', gap: 5, alignItems: 'center' }}>
        <Sparkles size={12} color="var(--tm-magenta)" style={{ marginRight: 4 }} />
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Thoth is thinking…</span>
      </div>
    </div>
  )
}

// ============================================
// Format LLM response to display text
// ============================================
function formatResponse(result: QueryResult): string {
  switch (result.action) {
    case 'answered':
      return result.answer || 'I found some information but could not format a response.'
    case 'clarified':
      return result.clarifying_question || 'Could you provide more details?'
    case 'routed_sme': {
      const smeName = result.routed_sme?.full_name || 'the appropriate expert'
      return `I don't have a complete answer in the knowledge base for this. I'm connecting you with ${smeName}, who owns this area.`
    }
    case 'routed_admin':
      return "This question falls outside our current knowledge base coverage. I've logged it for the admin team — they'll make sure this knowledge gets captured."
    default:
      return result.answer || 'Please try rephrasing your question.'
  }
}
