'use client'

import { useState, useEffect } from 'react'
import type { KBEntry } from '@/types'

export default function AdminDashboard() {
  const [pending, setPending] = useState<KBEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<KBEntry | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kb/approve?status=pending_review')
      const data = await res.json()
      setPending(data.entries || [])
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (entry_id: string) => {
    setActionLoading(true)
    await fetch('/api/kb/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin_approve', kb_entry_id: entry_id, approved_by: 'admin' })
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

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Pending Review', value: pending.length, color: 'text-yellow-400' },
          { label: 'Total Approved', value: '—', color: 'text-emerald-400' },
          { label: 'SMEs Active', value: '—', color: 'text-blue-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">{stat.label}</p>
            <p className={`text-3xl font-light ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Pending entries */}
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
                  <div>
                    <h4 className="text-white font-medium">{entry.topic_tag.replace(/_/g, ' ')}</h4>
                    <p className="text-white/40 text-sm mt-0.5">
                      SME: {entry.sme_profiles?.full_name || entry.sme_id}
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

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50">
          <div className="bg-[#111] border border-white/15 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-white text-lg font-medium">
                {selected.topic_tag.replace(/_/g, ' ')}
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
                <span className={`text-xs px-2 py-1 rounded-full ${
                  selected.exposable_to_users
                    ? 'bg-emerald-400/10 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`}>
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
