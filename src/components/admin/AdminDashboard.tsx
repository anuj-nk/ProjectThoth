'use client'

import { useState, useEffect } from 'react'
import type { KBEntry, AdminQueueEntry } from '@/types'

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

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h2 className="text-white text-2xl font-light mb-8">Admin Dashboard</h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Pending Review', value: pending.length, color: 'text-yellow-400' },
          { label: 'Queue Items', value: queue.length, color: 'text-orange-400' },
          { label: 'SMEs Active', value: '—', color: 'text-blue-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">{stat.label}</p>
            <p className={`text-3xl font-light ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
        {([
          { key: 'kb', label: `KB Queue (${pending.length})` },
          { key: 'queue', label: `Admin Queue (${queue.length})` },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === t.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* KB Approval Tab */}
      {tab === 'kb' && (
        <div>
          <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">
            Pending Admin Approval ({pending.length})
          </h3>
          {loading ? (
            <div className="text-white/40 text-sm">Loading...</div>
          ) : pending.length === 0 ? (
            <div className="border border-white/10 rounded-xl p-8 text-center">
              <p className="text-white/40 text-sm">No entries pending review</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(entry => (
                <div
                  key={entry.entry_id}
                  className="border border-white/10 hover:border-white/20 rounded-xl p-5 cursor-pointer transition-colors"
                  onClick={() => setSelected(entry)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium">
                        {(Array.isArray(entry.topic_tag) ? entry.topic_tag : [entry.topic_tag])
                          .map(id => id.replace(/_/g, ' ')).join(' · ')}
                      </h4>
                      <p className="text-white/40 text-sm mt-0.5">
                        SME: {entry.sme_profiles?.full_name || entry.sme_id}
                        {entry.sme_profiles?.title && ` — ${entry.sme_profiles.title}`}
                      </p>
                      <p className="text-white/60 text-sm mt-2 line-clamp-2 leading-relaxed">
                        {entry.question_framing}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); handleApprove(entry.entry_id) }}
                        disabled={actionLoading}
                        className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleReject(entry.entry_id) }}
                        disabled={actionLoading}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin Queue Tab */}
      {tab === 'queue' && (
        <div>
          <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">
            Admin Queue — Unhandled Signals ({queue.length})
          </h3>
          {queue.length === 0 ? (
            <div className="border border-white/10 rounded-xl p-8 text-center">
              <p className="text-white/40 text-sm">Queue is clear</p>
              <p className="text-white/20 text-xs mt-1">Unmatched topics and unanswered queries appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map(item => (
                <div key={item.queue_id} className="border border-white/10 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-400/10 text-orange-400 mr-2">
                        {item.source}
                      </span>
                      <span className="text-white/50 text-xs">{item.signal_type}</span>
                    </div>
                    <span className="text-white/30 text-xs">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-white/70 text-sm">{JSON.stringify(item.payload ?? {}).slice(0, 120)}...</p>
                  <div className="flex gap-2 mt-3">
                    <button className="text-white/40 text-xs border border-white/10 rounded px-3 py-1 hover:border-white/30">
                      Mark resolved
                    </button>
                    <button className="text-white/40 text-xs border border-white/10 rounded px-3 py-1 hover:border-white/30">
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50">
          <div className="bg-[#111] border border-white/15 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-white text-lg font-medium">
                {(Array.isArray(selected.topic_tag) ? selected.topic_tag : [selected.topic_tag])
                  .map(id => id.replace(/_/g, ' ')).join(' · ')}
              </h3>
              <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white text-xl">×</button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest block mb-1">Question</label>
                <p className="text-white/80 text-sm">{selected.question_framing}</p>
              </div>
              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest block mb-1">Answer</label>
                <p className="text-white/80 text-sm leading-relaxed">{selected.synthesized_answer}</p>
              </div>
              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest block mb-1">SME</label>
                <p className="text-white/80 text-sm">
                  {selected.sme_profiles?.full_name || selected.sme_id}
                  {selected.sme_profiles?.title && ` — ${selected.sme_profiles.title}`}
                </p>
              </div>
              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest block mb-1">Visibility</label>
                <span className={`text-xs px-2 py-1 rounded-full ${selected.exposable_to_users ? 'bg-emerald-400/10 text-emerald-400' : 'bg-white/5 text-white/40'}`}>
                  {selected.exposable_to_users ? 'Public' : 'Internal only'}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(selected.entry_id)}
                disabled={actionLoading}
                className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-40"
              >
                {actionLoading ? 'Processing...' : '✓ Approve & Publish'}
              </button>
              <button
                onClick={() => handleReject(selected.entry_id)}
                disabled={actionLoading}
                className="flex-1 border border-white/20 hover:border-white/40 text-white/60 hover:text-white rounded-xl py-2.5 text-sm transition-colors"
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
