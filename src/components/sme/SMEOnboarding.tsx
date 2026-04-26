'use client'

import { useState } from 'react'
import type { SMEProfile, KBEntry, InterviewMessage } from '@/types'
import { v4 as uuidv4 } from 'uuid'

type SMEView = 'dashboard' | 'new_interview' | 'review_entry'

export default function SMEOnboarding({ smeProfile }: { smeProfile: SMEProfile }) {
  const [view, setView] = useState<SMEView>('dashboard')
  const [selectedEntry, setSelectedEntry] = useState<KBEntry | null>(null)
  const [entries, setEntries] = useState<KBEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)

  const loadEntries = async () => {
    setLoadingEntries(true)
    try {
      const res = await fetch(`/api/kb/approve?sme_id=${smeProfile.id}`)
      const data = await res.json()
      setEntries(data.entries || [])
    } finally {
      setLoadingEntries(false)
    }
  }

  const handleReview = (entry: KBEntry) => {
    setSelectedEntry(entry)
    setView('review_entry')
  }

  if (view === 'new_interview') {
    return (
      <InterviewFlow
        smeProfile={smeProfile}
        onComplete={() => { setView('dashboard'); loadEntries() }}
        onBack={() => setView('dashboard')}
      />
    )
  }

  if (view === 'review_entry' && selectedEntry) {
    return (
      <EntryReview
        entry={selectedEntry}
        onComplete={() => { setView('dashboard'); loadEntries() }}
        onBack={() => setView('dashboard')}
      />
    )
  }

  // Dashboard view
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-white text-2xl font-light mb-1">Welcome back, {smeProfile.name}</h2>
        <p className="text-white/40 text-sm">{smeProfile.role} · {smeProfile.email}</p>
      </div>

      {/* Topics owned */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <h3 className="text-white/60 text-xs uppercase tracking-widest mb-3">Your Topic Coverage</h3>
        <div className="flex flex-wrap gap-2">
          {smeProfile.topics_owned.map(t => (
            <span key={t} className="bg-[#e20074]/20 text-[#e20074] text-sm px-3 py-1 rounded-full border border-[#e20074]/30">
              {t}
            </span>
          ))}
          {smeProfile.topics_owned.length === 0 && (
            <span className="text-white/30 text-sm">No topics defined yet — start an interview to add some</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setView('new_interview')}
          className="group border border-white/10 hover:border-[#e20074]/60 rounded-xl p-6 text-left transition-all hover:bg-white/5"
        >
          <div className="text-2xl mb-3">🎤</div>
          <h3 className="text-white font-medium mb-1">Start New Interview</h3>
          <p className="text-white/40 text-sm">Add a new topic to the knowledge base</p>
        </button>

        <button
          onClick={loadEntries}
          className="group border border-white/10 hover:border-[#e20074]/60 rounded-xl p-6 text-left transition-all hover:bg-white/5"
        >
          <div className="text-2xl mb-3">📋</div>
          <h3 className="text-white font-medium mb-1">Review My Entries</h3>
          <p className="text-white/40 text-sm">View and approve pending KB entries</p>
        </button>
      </div>

      {/* Entries list */}
      {entries.length > 0 && (
        <div>
          <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">Your Knowledge Entries</h3>
          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-white text-sm font-medium">{entry.title}</h4>
                  <p className="text-white/40 text-xs mt-0.5">{entry.topic} · {entry.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={entry.status} />
                  {entry.status === 'pending_sme' && (
                    <button
                      onClick={() => handleReview(entry)}
                      className="text-[#e20074] text-xs hover:underline"
                    >
                      Review →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Interview Flow Component
// ============================================
function InterviewFlow({
  smeProfile,
  onComplete,
  onBack
}: {
  smeProfile: SMEProfile
  onComplete: () => void
  onBack: () => void
}) {
  const [messages, setMessages] = useState<InterviewMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [interviewId, setInterviewId] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const [phase, setPhase] = useState<'setup' | 'interview' | 'synthesizing' | 'done'>('setup')
  const [kbEntry, setKbEntry] = useState<KBEntry | null>(null)

  const startInterview = async () => {
    if (!topic.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/sme/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', sme_id: smeProfile.id, topic })
      })
      const data = await res.json()
      setInterviewId(data.interview_id)
      setMessages([{
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString()
      }])
      setPhase('interview')
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !interviewId) return

    const userMsg: InterviewMessage = {
      role: 'sme',
      content: input,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/sme/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'message', interview_id: interviewId, message: input })
      })
      const data = await res.json()

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString()
      }])

      if (data.status === 'completed') {
        setTimeout(() => synthesize(), 1000)
      }
    } finally {
      setLoading(false)
    }
  }

  const synthesize = async () => {
    setPhase('synthesizing')
    try {
      const res = await fetch('/api/sme/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'synthesize', interview_id: interviewId, sme_id: smeProfile.id })
      })
      const data = await res.json()
      setKbEntry(data.kb_entry)
      setPhase('done')
    } catch {
      setPhase('interview')
    }
  }

  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <button onClick={onBack} className="text-white/40 hover:text-white text-sm mb-8 flex items-center gap-2">
          ← Back
        </button>
        <h2 className="text-white text-2xl font-light mb-2">New Knowledge Interview</h2>
        <p className="text-white/40 text-sm mb-8">Thoth will guide you through a structured interview to capture your expertise.</p>

        <div className="space-y-4">
          <div>
            <label className="text-white/60 text-xs uppercase tracking-widest block mb-2">Topic to capture</label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startInterview()}
              placeholder="e.g. Vendor Contracts, IP Policy, Onboarding Process..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#e20074]/50"
            />
          </div>
          <button
            onClick={startInterview}
            disabled={!topic.trim() || loading}
            className="w-full bg-[#e20074] hover:bg-[#c4005f] disabled:opacity-40 text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            {loading ? 'Starting...' : 'Begin Interview'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'synthesizing') {
    return (
      <div className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-2 border-[#e20074]/30 border-t-[#e20074] rounded-full animate-spin mb-6" />
        <p className="text-white text-lg font-light">Synthesizing your knowledge...</p>
        <p className="text-white/40 text-sm mt-2">Preparing a structured preview for your review</p>
      </div>
    )
  }

  if (phase === 'done' && kbEntry) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6">
          <p className="text-emerald-400 text-sm">✓ Interview complete! Your knowledge has been synthesized and submitted for review.</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h3 className="text-white/60 text-xs uppercase tracking-widest mb-3">Synthesized Entry Preview</h3>
          <h2 className="text-white text-xl font-medium mb-2">{kbEntry.title}</h2>
          <p className="text-white/60 text-sm mb-4">{kbEntry.topic}</p>
          <p className="text-white/80 text-sm leading-relaxed">{kbEntry.content}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {kbEntry.keywords.map(k => (
              <span key={k} className="text-white/40 text-xs bg-white/5 rounded px-2 py-1">{k}</span>
            ))}
          </div>
        </div>
        <p className="text-white/40 text-sm mb-6">Status: Pending your approval → then Admin review → Published to KB</p>
        <button onClick={onComplete} className="bg-[#e20074] hover:bg-[#c4005f] text-white rounded-xl px-6 py-3 text-sm font-medium transition-colors">
          Back to Dashboard
        </button>
      </div>
    )
  }

  // Interview in progress
  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      <div className="border-b border-white/10 px-6 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-white/40 hover:text-white text-sm">←</button>
        <span className="text-white/60 text-sm">Interview: <span className="text-white">{topic}</span></span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'sme' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
              ${msg.role === 'sme'
                ? 'bg-[#e20074] text-white rounded-tr-sm'
                : 'bg-white/8 text-white/85 border border-white/10 rounded-tl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/8 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Your response..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#e20074]/50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-[#e20074] hover:bg-[#c4005f] disabled:opacity-40 text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Entry Review Component
// ============================================
function EntryReview({ entry, onComplete, onBack }: {
  entry: KBEntry
  onComplete: () => void
  onBack: () => void
}) {
  const [content, setContent] = useState(entry.content)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'approved' | 'rejected'>('idle')

  const handleApprove = async () => {
    setLoading(true)
    await fetch('/api/kb/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sme_approve', kb_entry_id: entry.id, edits: { content } })
    })
    setStatus('approved')
    setLoading(false)
  }

  const handleReject = async () => {
    setLoading(true)
    await fetch('/api/kb/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sme_reject', kb_entry_id: entry.id, edits: { content } })
    })
    setStatus('rejected')
    setLoading(false)
  }

  if (status !== 'idle') {
    return (
      <div className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className={`text-5xl mb-4`}>{status === 'approved' ? '✅' : '↩️'}</div>
        <p className="text-white text-lg font-light mb-2">
          {status === 'approved' ? 'Submitted for admin review!' : 'Returned to draft'}
        </p>
        <button onClick={onComplete} className="mt-6 text-[#e20074] text-sm hover:underline">
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <button onClick={onBack} className="text-white/40 hover:text-white text-sm mb-8">← Back</button>
      <h2 className="text-white text-2xl font-light mb-2">Review Knowledge Entry</h2>
      <p className="text-white/40 text-sm mb-6">Edit if needed, then approve to submit for admin review.</p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="text-white/60 text-xs uppercase tracking-widest block mb-2">Title</label>
          <p className="text-white bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm">{entry.title}</p>
        </div>
        <div>
          <label className="text-white/60 text-xs uppercase tracking-widest block mb-2">Content (editable)</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={10}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#e20074]/50 resize-none leading-relaxed"
          />
        </div>
        <div>
          <label className="text-white/60 text-xs uppercase tracking-widest block mb-2">Keywords</label>
          <div className="flex flex-wrap gap-2">
            {entry.keywords.map(k => (
              <span key={k} className="text-white/40 text-xs bg-white/5 rounded px-2 py-1">{k}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 bg-[#e20074] hover:bg-[#c4005f] disabled:opacity-40 text-white rounded-xl py-3 text-sm font-medium transition-colors"
        >
          {loading ? 'Submitting...' : '✓ Approve & Submit'}
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex-1 border border-white/20 hover:border-white/40 text-white/60 hover:text-white rounded-xl py-3 text-sm transition-colors"
        >
          ↩ Return to Draft
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    draft: 'text-white/40 bg-white/5',
    pending_sme: 'text-yellow-400 bg-yellow-400/10',
    pending_admin: 'text-blue-400 bg-blue-400/10',
    approved: 'text-emerald-400 bg-emerald-400/10',
    archived: 'text-white/20 bg-white/5'
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${config[status] || 'text-white/40 bg-white/5'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
