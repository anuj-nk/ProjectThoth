'use client'

import { useState, useEffect } from 'react'
import type { KBEntry, AdminQueueEntry } from '@/types'

const s: Record<string, React.CSSProperties> = {
  page:       { maxWidth: 900, margin: '0 auto', padding: '40px 28px' },
  h1:         { fontSize: 26, fontWeight: 700, color: '#000000', letterSpacing: -0.5, marginBottom: 28 },
  statGrid:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 32 },
  statCard:   { background: 'white', border: '1px solid var(--border)', borderRadius: 24, padding: '20px 24px' },
  statLabel:  { fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8, fontWeight: 700 },
  statValue:  { fontSize: 34, fontWeight: 300, color: '#000000' },
  tabBar:     { display: 'flex', gap: 4, background: 'white', border: '1px solid var(--border)', borderRadius: 999, padding: 4, width: 'fit-content', marginBottom: 24 },
  sectionHd:  { fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 14, fontWeight: 700 },
  card:       { background: 'white', border: '1px solid var(--border)', borderRadius: 24, padding: '18px 22px', cursor: 'pointer', marginBottom: 10 },
  empty:      { background: 'white', border: '1px solid var(--border)', borderRadius: 24, padding: 48, textAlign: 'center' as const },
  btnApprove: { background: '#F0FDF4', color: '#15803D', border: '1px solid #86EFAC', borderRadius: 999, fontSize: 14, padding: '7px 16px', cursor: 'pointer', fontWeight: 600 },
  btnReject:  { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 999, fontSize: 14, padding: '7px 16px', cursor: 'pointer', fontWeight: 600 },
  overlay:    { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 },
  modal:      { background: 'white', border: '1px solid var(--border)', borderRadius: 28, padding: 36, maxWidth: 640, width: '100%', maxHeight: '82vh', overflowY: 'auto' as const, boxShadow: '0 12px 48px rgba(0,0,0,0.14)' },
  fieldLbl:   { fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6, fontWeight: 700 },
}

export default function AdminDashboard() {
  const [pending, setPending] = useState<KBEntry[]>([])
  const [queue, setQueue] = useState<AdminQueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<KBEntry | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [tab, setTab] = useState<'kb' | 'queue'>('kb')

  useEffect(() => { loadDashboard() }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [pendingRes, queueRes] = await Promise.all([
        fetch('/api/kb/approve?status=pending_review'),
        fetch('/api/admin/queue')
      ])
      const pendingData = await pendingRes.json()
      setPending(pendingData.entries || [])
      if (queueRes.ok) {
        const queueData = await queueRes.json()
        setQueue(queueData.entries || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (entry_id: string) => {
    setActionLoading(true)
    await fetch('/api/kb/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin_approve', kb_entry_id: entry_id })
    })
    setSelected(null)
    await loadDashboard()
    setActionLoading(false)
  }

  const handleReject = async (entry_id: string) => {
    setActionLoading(true)
    await fetch('/api/kb/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin_reject', kb_entry_id: entry_id })
    })
    setSelected(null)
    await loadDashboard()
    setActionLoading(false)
  }

  const topicLabel = (tag: string | string[]) =>
    (Array.isArray(tag) ? tag : [tag]).map(t => t.replace(/_/g, ' ')).join(' · ')

  return (
    <div style={s.page}>
      <h2 style={s.h1}>Admin Dashboard</h2>

      {/* Stats */}
      <div style={s.statGrid}>
        {[
          { label: 'Pending Review', value: pending.length, accent: '#92600A' },
          { label: 'Admin Queue', value: queue.length, accent: '#9A3412' },
          { label: 'Active SMEs', value: '—', accent: 'var(--text-3)' },
        ].map(stat => (
          <div key={stat.label} style={s.statCard}>
            <div style={s.statLabel}>{stat.label}</div>
            <div style={{ ...s.statValue, color: stat.accent }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {([
          { key: 'kb' as const, label: `KB Queue (${pending.length})` },
          { key: 'queue' as const, label: `Admin Queue (${queue.length})` },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '9px 20px', borderRadius: 999, border: 'none', fontSize: 14, cursor: 'pointer',
              background: tab === t.key ? 'var(--tm-magenta)' : 'transparent',
              color: tab === t.key ? 'white' : 'var(--text-2)',
              fontWeight: tab === t.key ? 600 : 400,
              transition: 'all 0.15s'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* KB Approval Tab */}
      {tab === 'kb' && (
        <div>
          <div style={s.sectionHd}>Pending Admin Approval ({pending.length})</div>
          {loading ? (
            <div style={{ color: 'var(--text-3)', fontSize: 15 }}>Loading…</div>
          ) : pending.length === 0 ? (
            <div style={s.empty}>
              <p style={{ color: 'var(--text-3)', fontSize: 16 }}>No entries pending review</p>
              <p style={{ color: 'var(--text-3)', fontSize: 14, marginTop: 6 }}>SME-approved entries will appear here</p>
            </div>
          ) : (
            pending.map(entry => (
              <div
                key={entry.entry_id}
                style={s.card}
                onClick={() => setSelected(entry)}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--tm-magenta)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ padding: '3px 10px', background: 'var(--wine-light)', color: 'var(--wine)', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
                        {topicLabel(entry.topic_tag)}
                      </span>
                      {entry.exposable_to_users
                        ? <span style={{ fontSize: 12, color: '#15803D', fontWeight: 500 }}>Public</span>
                        : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Internal</span>
                      }
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-1)', marginBottom: 4 }}>{entry.question_framing}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-2)' }}>
                      SME: {(entry as any).sme_profiles?.full_name || entry.sme_id}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleApprove(entry.entry_id) }}
                      disabled={actionLoading}
                      style={{ ...s.btnApprove, opacity: actionLoading ? 0.5 : 1 }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleReject(entry.entry_id) }}
                      disabled={actionLoading}
                      style={{ ...s.btnReject, opacity: actionLoading ? 0.5 : 1 }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Admin Queue Tab */}
      {tab === 'queue' && (
        <div>
          <div style={s.sectionHd}>Unhandled Signals ({queue.length})</div>
          {queue.length === 0 ? (
            <div style={s.empty}>
              <p style={{ color: 'var(--text-3)', fontSize: 16 }}>Queue is clear</p>
              <p style={{ color: 'var(--text-3)', fontSize: 14, marginTop: 6 }}>Unmatched topics and low-confidence queries appear here</p>
            </div>
          ) : (
            queue.map(item => (
              <div key={item.queue_id} style={{ ...s.card, cursor: 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, padding: '3px 10px', background: '#FFF7ED', color: '#9A3412', borderRadius: 12, fontWeight: 600 }}>
                      {item.source}
                    </span>
                    <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{item.signal_type}</span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
                <p style={{ fontSize: 15, color: 'var(--text-1)', lineHeight: 1.6 }}>
                  {typeof item.payload === 'object' ? (item.payload as any).question || JSON.stringify(item.payload).slice(0, 120) : String(item.payload).slice(0, 120)}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button style={{ fontSize: 14, color: 'var(--text-2)', background: 'white', border: '1px solid var(--border-strong)', borderRadius: 20, padding: '6px 14px', cursor: 'pointer' }}>
                    Mark resolved
                  </button>
                  <button style={{ fontSize: 14, color: 'var(--text-3)', background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', cursor: 'pointer' }}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div style={s.overlay} onClick={() => setSelected(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <span style={{ padding: '4px 12px', background: 'var(--wine-light)', color: 'var(--wine)', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
                  {topicLabel(selected.topic_tag)}
                </span>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-3)', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 28 }}>
              <div>
                <div style={s.fieldLbl}>Question</div>
                <p style={{ fontSize: 16, color: 'var(--text-1)', lineHeight: 1.6 }}>{selected.question_framing}</p>
              </div>
              <div>
                <div style={s.fieldLbl}>Synthesized Answer</div>
                <p style={{ fontSize: 15, color: 'var(--text-1)', lineHeight: 1.7, background: 'var(--beige)', padding: '14px 16px', borderRadius: 10 }}>{selected.synthesized_answer}</p>
              </div>
              <div style={{ display: 'flex', gap: 28 }}>
                <div>
                  <div style={s.fieldLbl}>SME</div>
                  <p style={{ fontSize: 15, color: 'var(--text-1)' }}>
                    {(selected as any).sme_profiles?.full_name || selected.sme_id}
                    {(selected as any).sme_profiles?.title && <span style={{ color: 'var(--text-2)' }}> — {(selected as any).sme_profiles.title}</span>}
                  </p>
                </div>
                <div>
                  <div style={s.fieldLbl}>Visibility</div>
                  <span style={{ fontSize: 14, padding: '4px 10px', borderRadius: 10, background: selected.exposable_to_users ? '#F0FDF4' : 'var(--beige)', color: selected.exposable_to_users ? '#15803D' : 'var(--text-3)', fontWeight: 500 }}>
                    {selected.exposable_to_users ? 'Public' : 'Internal'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => handleApprove(selected.entry_id)}
                disabled={actionLoading}
                style={{ flex: 1, background: 'var(--tm-magenta)', color: 'white', border: 'none', borderRadius: 999, padding: '13px 0', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}
              >
                {actionLoading ? 'Processing…' : '✓ Approve & Publish'}
              </button>
              <button
                onClick={() => handleReject(selected.entry_id)}
                disabled={actionLoading}
                style={{ flex: 1, background: 'white', color: 'var(--text-2)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '13px 0', fontSize: 16, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}
              >
                ✕ Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
