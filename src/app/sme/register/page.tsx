'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { InterviewMessage, KBEntry, RoutingPreference } from '@/types'
import { CAREER_SERVICES_TOPICS, TOPIC_BY_ID } from '@/lib/taxonomy'

// ============================================
// Stage ribbon — 3 stages matching prototype
// ============================================
const STAGES = [
  { label: 'Profile', screens: ['paste', 'extracting', 'profile_review', 'boundaries'] },
  { label: 'Interview', screens: ['interview'] },
  { label: 'Review', screens: ['synthesizing', 'synthesis_review', 'done'] },
] as const

type Screen =
  | 'paste' | 'extracting' | 'profile_review' | 'boundaries'
  | 'interview' | 'synthesizing' | 'synthesis_review' | 'done'

type Channel = RoutingPreference['channel']

interface DraftProfile {
  full_name: string
  email: string
  title: string
  domain: string
  topics: string[]
  exclusions: string[]
  routing_preferences: RoutingPreference[]
}

interface EntryState {
  entry: KBEntry
  answer: string
  approval: 'pending' | 'approved' | 'rejected'
}

const CHANNEL_LABELS: Record<Channel, string> = {
  teams: 'Teams message',
  email: 'Email',
  scheduling_link: 'Scheduling link',
  in_person: 'In person / by appointment',
}

export default function SMERegisterPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('paste')
  const [rawInput, setRawInput] = useState('')
  const [extractError, setExtractError] = useState('')
  const [unmatchedTopics, setUnmatchedTopics] = useState<string[]>([])

  const [draft, setDraft] = useState<DraftProfile>({
    full_name: '', email: '', title: '',
    domain: 'career_services',
    topics: [], exclusions: [], routing_preferences: []
  })

  const [smeId, setSmeId] = useState<string | null>(null)
  const [interviewId, setInterviewId] = useState<string | null>(null)
  const [messages, setMessages] = useState<InterviewMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [interviewDone, setInterviewDone] = useState(false)

  const [entryStates, setEntryStates] = useState<EntryState[]>([])
  const [submitting, setSubmitting] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Stage + nav helpers ──────────────────────────────────────────────────

  const stageIndex = STAGES.findIndex(s => (s.screens as readonly string[]).includes(screen))

  const SCREEN_ORDER: Screen[] = [
    'paste', 'extracting', 'profile_review', 'boundaries',
    'interview', 'synthesizing', 'synthesis_review', 'done'
  ]
  const screenIdx = SCREEN_ORDER.indexOf(screen)

  // ── Extract profile (screen 1 → 2 → 3) ────────────────────────────────

  const handleExtract = async () => {
    if (!rawInput.trim()) return
    setExtractError('')
    setScreen('extracting')
    try {
      const res = await fetch('/api/sme/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract', raw_input: rawInput })
      })
      const data = await res.json()
      if (!res.ok) { setExtractError(data.error || 'Extraction failed'); setScreen('paste'); return }
      const p = data.draft_profile
      setDraft({
        full_name: p.full_name || '',
        email: p.email || '',
        title: p.title || '',
        domain: p.domain || 'career_services',
        topics: p.topics || [],
        exclusions: p.exclusions || [],
        routing_preferences: p.routing_preferences || []
      })
      setUnmatchedTopics(data.unmatched_topics || [])
      setScreen('profile_review')
    } catch {
      setExtractError('Network error. Try again.')
      setScreen('paste')
    }
  }

  // ── Save profile + start interview (screen 4 → 5) ─────────────────────

  const handleStartInterview = async () => {
    if (!draft.full_name || !draft.email || !draft.domain) return
    setScreen('extracting') // reuse spinner while saving

    try {
      // Save profile to DB
      const profileRes = await fetch('/api/sme/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      })
      const profileData = await profileRes.json()
      if (!profileRes.ok) { setExtractError(profileData.error); setScreen('boundaries'); return }
      const sme = profileData.profile
      setSmeId(sme.sme_id)

      // Create interview session
      const topic = draft.topics[0] || 'general'
      const ivRes = await fetch('/api/sme/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', sme_id: sme.sme_id, topic })
      })
      const ivData = await ivRes.json()
      setInterviewId(ivData.interview_id)
      setMessages([{ role: 'assistant', content: ivData.message, timestamp: new Date().toISOString() }])
      setScreen('interview')
    } catch {
      setExtractError('Failed to save profile. Try again.')
      setScreen('boundaries')
    }
  }

  // ── Interview messaging ────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading || !interviewId) return
    const userMsg: InterviewMessage = { role: 'sme', content: chatInput, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/sme/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'message', interview_id: interviewId, message: chatInput })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, timestamp: new Date().toISOString() }])
      if (data.status === 'completed') setInterviewDone(true)
    } finally {
      setChatLoading(false)
    }
  }

  // ── Synthesize (screen 5 → 6 → 7) ─────────────────────────────────────

  const handleSynthesize = async () => {
    if (!interviewId || !smeId) return
    setScreen('synthesizing')
    try {
      const res = await fetch('/api/sme/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'synthesize', interview_id: interviewId, sme_id: smeId })
      })
      const data = await res.json()
      const entries: KBEntry[] = data.kb_entries || []
      setEntryStates(entries.map(e => ({ entry: e, answer: e.synthesized_answer, approval: 'pending' })))
      setScreen('synthesis_review')
    } catch {
      setScreen('interview')
    }
  }

  // ── Submit approved entries ────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitting(true)
    const toApprove = entryStates.filter(s => s.approval === 'approved')
    await Promise.all(toApprove.map(s =>
      fetch('/api/kb/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sme_approve',
          kb_entry_id: s.entry.entry_id,
          sme_id: smeId,
          edits: { synthesized_answer: s.answer }
        })
      })
    ))
    setSubmitting(false)
    setScreen('done')
  }

  // ── Topic / channel helpers ────────────────────────────────────────────

  const toggleTopic = (id: string) =>
    setDraft(d => ({
      ...d,
      topics: d.topics.includes(id) ? d.topics.filter(t => t !== id) : [...d.topics, id]
    }))

  const toggleExclusion = (id: string) =>
    setDraft(d => ({
      ...d,
      exclusions: d.exclusions.includes(id) ? d.exclusions.filter(t => t !== id) : [...d.exclusions, id]
    }))

  const addChannel = (ch: Channel) => {
    if (draft.routing_preferences.some(r => r.channel === ch)) return
    setDraft(d => ({
      ...d,
      routing_preferences: [...d.routing_preferences, { channel: ch, priority: d.routing_preferences.length + 1 }]
    }))
  }

  const removeChannel = (ch: Channel) =>
    setDraft(d => ({
      ...d,
      routing_preferences: d.routing_preferences
        .filter(r => r.channel !== ch)
        .map((r, i) => ({ ...r, priority: i + 1 }))
    }))

  const moveChannel = (idx: number, dir: -1 | 1) => {
    const prefs = [...draft.routing_preferences]
    const target = idx + dir
    if (target < 0 || target >= prefs.length) return;
    [prefs[idx], prefs[target]] = [prefs[target], prefs[idx]]
    setDraft(d => ({ ...d, routing_preferences: prefs.map((r, i) => ({ ...r, priority: i + 1 })) }))
  }

  const approvedCount = entryStates.filter(s => s.approval === 'approved').length

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: '#FAFAFA', minHeight: '100vh', color: 'var(--text-1)', lineHeight: 1.5 }}>

      {/* ── Header ── */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 20px 0' }}>
        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.5 }}>Thoth</span>
                <span style={{ fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  A <strong style={{ color: 'var(--tm-magenta)' }}>T-Mobile</strong> × GIX project
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              {screen === 'done' ? 'All done!' : 'Auto-saving'}
            </div>
          </div>

          {/* Stage ribbon */}
          <StageRibbon stageIndex={stageIndex} />
        </div>
      </div>

      {/* ── Screen content ── */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px 100px' }}>

        {/* Screen 1: Paste */}
        {screen === 'paste' && (
          <Card>
            <StageLabel>Step 1 · Tell me about yourself</StageLabel>
            <h1 style={h1Style}>Welcome to Thoth</h1>
            <p style={subtitleStyle}>I'll help you share your knowledge with GIX students — without filling out a 20-field form. Paste anything that describes your role and I'll figure out the rest.</p>
            <h2 style={h2Style}>What can I paste?</h2>
            <div style={hintBoxStyle}>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                <div style={{ padding: '2px 0' }}>• A link to your GIX profile page or LinkedIn</div>
                <div style={{ padding: '2px 0' }}>• A job description or bio paragraph</div>
                <div style={{ padding: '2px 0' }}>• Or just describe your role in a few sentences</div>
              </div>
            </div>
            <textarea
              rows={4}
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              placeholder="https://gix.uw.edu/about/people/... or paste a description..."
              style={textareaStyle}
            />
            {extractError && <div style={errorStyle}>{extractError}</div>}
            <BtnRow>
              <button onClick={() => router.push('/')} style={btnTertiary}>Cancel</button>
              <button onClick={handleExtract} disabled={!rawInput.trim()} style={rawInput.trim() ? btnPrimary : btnDisabled}>
                Let Thoth figure it out →
              </button>
            </BtnRow>
          </Card>
        )}

        {/* Screen 2 / loading screen */}
        {screen === 'extracting' && (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={spinnerStyle} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Reading your profile...</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Extracting name, title, domain, and areas of expertise</div>
            </div>
          </Card>
        )}

        {/* Screen 3: Profile review */}
        {screen === 'profile_review' && (
          <Card>
            <StageLabel>Step 2 · Review what I found</StageLabel>
            <h1 style={h1Style}>Here's what I found</h1>
            <p style={subtitleStyle}>Review and correct anything I got wrong. Use the topic list to add or remove areas you own.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Source */}
              <div>
                <div style={colLabelStyle}>What you gave me</div>
                <div style={sourceBoxStyle}>{rawInput}</div>
              </div>
              {/* Extracted */}
              <div>
                <div style={colLabelStyle}>What I extracted</div>
                {([
                  ['Name', 'full_name'],
                  ['Email', 'email'],
                  ['Title / Role', 'title'],
                ] as const).map(([label, key]) => (
                  <div key={key} style={{ marginBottom: 14 }}>
                    <div style={fieldLabelStyle}>{label}</div>
                    <input
                      value={draft[key] as string}
                      onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: 14 }}>
                  <div style={fieldLabelStyle}>Domain</div>
                  <div style={{ padding: '8px 12px', background: 'var(--beige)', borderRadius: 6, fontSize: 14 }}>
                    Career Services
                  </div>
                </div>
              </div>
            </div>

            {/* Topics */}
            <div style={{ marginTop: 20 }}>
              <div style={fieldLabelStyle}>Topics you cover <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(click to toggle)</span></div>
              {unmatchedTopics.length > 0 && (
                <div style={{ ...warningBoxStyle, marginBottom: 10 }}>
                  Couldn't match to taxonomy: <strong>{unmatchedTopics.join(', ')}</strong>. Select the closest topics below or they'll go to the admin queue.
                </div>
              )}
              <div style={chipAreaStyle}>
                {CAREER_SERVICES_TOPICS.map(t => (
                  <span
                    key={t.id}
                    onClick={() => toggleTopic(t.id)}
                    style={draft.topics.includes(t.id) ? chipPrimaryStyle : chipStyle}
                  >
                    {draft.topics.includes(t.id) ? '★' : '☆'} {t.display}
                  </span>
                ))}
              </div>
            </div>

            <BtnRow>
              <button onClick={() => setScreen('paste')} style={btnTertiary}>← Back</button>
              <button onClick={() => setScreen('boundaries')} style={btnPrimary}>Looks good →</button>
            </BtnRow>
          </Card>
        )}

        {/* Screen 4: Boundaries + routing */}
        {screen === 'boundaries' && (
          <Card>
            <StageLabel>Step 3 · Boundaries &amp; routing</StageLabel>
            <h1 style={h1Style}>A few more questions</h1>
            <p style={subtitleStyle}>This helps Thoth route students to you — and only to you — when it's actually your area.</p>

            <h2 style={{ ...h2Style, marginTop: 12 }}>Which topics are NOT your responsibility?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>Check anything outside your scope. Leave things you DO own unchecked.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
              {CAREER_SERVICES_TOPICS.map(t => {
                const checked = draft.exclusions.includes(t.id)
                return (
                  <label key={t.id} style={{
                    padding: '8px 12px', background: checked ? 'var(--danger-bg)' : 'white',
                    border: `1px solid ${checked ? '#F7C1C1' : 'var(--border)'}`, borderRadius: 6,
                    fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleExclusion(t.id)} style={{ width: 'auto' }} />
                    <span>{t.display}</span>
                  </label>
                )
              })}
            </div>
            <div style={{ marginBottom: 24, padding: '10px 14px', background: 'var(--beige)', borderRadius: 6, fontSize: 12, color: 'var(--text-2)', borderLeft: '3px solid var(--wine)' }}>
              <strong>Note:</strong> If you partly own a topic, leave it unchecked. The interview will clarify exact boundaries.
            </div>

            <h2 style={{ ...h2Style, marginTop: 4 }}>When Thoth can't answer, how should it reach you?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>Add channels and reorder by priority (use ↑↓).</p>

            {/* Channel picker */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {(Object.keys(CHANNEL_LABELS) as Channel[]).map(ch => (
                !draft.routing_preferences.some(r => r.channel === ch) && (
                  <button key={ch} onClick={() => addChannel(ch)} style={btnTertiary}>
                    + {CHANNEL_LABELS[ch]}
                  </button>
                )
              ))}
            </div>

            {/* Routing rows */}
            {draft.routing_preferences.length > 0 && (
              <div style={{ paddingTop: 8 }}>
                {draft.routing_preferences.map((pref, idx) => (
                  <div key={pref.channel} style={{
                    padding: '12px 14px', background: idx === 0 ? 'var(--wine-light)' : 'white',
                    border: `1px solid ${idx === 0 ? 'var(--wine)' : 'var(--border)'}`,
                    borderRadius: 8, margin: '10px 0',
                    display: 'flex', alignItems: 'center', gap: 12, position: 'relative'
                  }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--wine)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <span style={{ flex: 1, fontSize: 13 }}>{CHANNEL_LABELS[pref.channel]}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => moveChannel(idx, -1)} disabled={idx === 0} style={{ ...btnTertiary, padding: '2px 8px', fontSize: 12, opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                      <button onClick={() => moveChannel(idx, 1)} disabled={idx === draft.routing_preferences.length - 1} style={{ ...btnTertiary, padding: '2px 8px', fontSize: 12, opacity: idx === draft.routing_preferences.length - 1 ? 0.3 : 1 }}>↓</button>
                      <button onClick={() => removeChannel(pref.channel)} style={{ ...btnDanger, padding: '2px 8px', fontSize: 12 }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {draft.routing_preferences.length === 0 && (
              <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>No channels added yet.</div>
            )}

            {extractError && <div style={errorStyle}>{extractError}</div>}
            <BtnRow>
              <button onClick={() => setScreen('profile_review')} style={btnTertiary}>← Back</button>
              <button
                onClick={handleStartInterview}
                disabled={!draft.full_name || !draft.email}
                style={draft.full_name && draft.email ? btnPrimary : btnDisabled}
              >
                Save &amp; Start Interview →
              </button>
            </BtnRow>
          </Card>
        )}

        {/* Screen 5: Interview */}
        {screen === 'interview' && (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '24px 28px 16px' }}>
              <StageLabel>Step 4 · Knowledge interview</StageLabel>
              <h1 style={{ ...h1Style, marginBottom: 4 }}>Let's talk about your work</h1>
              <p style={subtitleStyle}>Answer naturally. I'll ask structured follow-ups. When I'm done, click "Synthesize".</p>
              <div style={{ padding: '10px 14px', background: 'var(--beige)', borderRadius: 8, marginBottom: 14, fontSize: 12, color: 'var(--text-2)' }}>
                <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{messages.filter(m => m.role === 'assistant').length}</span> questions asked
              </div>
            </div>

            {/* Chat */}
            <div style={{ background: 'var(--beige)', padding: '16px 28px', minHeight: 200, maxHeight: 380, overflowY: 'auto' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  {msg.role === 'assistant' ? (
                    <div style={{ color: 'var(--text-1)', padding: '4px 0 4px 12px', maxWidth: '92%', fontSize: 14, borderLeft: '2px solid var(--wine)' }}>
                      <strong style={{ color: 'var(--wine)' }}>Thoth</strong><br /><br />
                      {msg.content}
                    </div>
                  ) : (
                    <div style={{ background: 'white', color: 'var(--text-1)', padding: '12px 16px', borderRadius: '12px 12px 2px 12px', maxWidth: '85%', marginLeft: 'auto', fontSize: 14, border: '1px solid var(--border)' }}>
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '4px 0 4px 12px', borderLeft: '2px solid var(--border-strong)' }}>
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '16px 28px 24px' }}>
              <textarea
                rows={2}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder="Type your response... (Enter to send)"
                style={{ ...textareaStyle, resize: 'none' }}
                disabled={chatLoading}
              />
              <BtnRow>
                {interviewDone ? (
                  <>
                    <button onClick={sendMessage} disabled={chatLoading || !chatInput.trim()} style={!chatLoading && chatInput.trim() ? btnPrimary : btnDisabled}>Send</button>
                    <button onClick={handleSynthesize} style={{ ...btnSuccess, marginLeft: 'auto' }}>Synthesize my knowledge →</button>
                  </>
                ) : (
                  <>
                    <button onClick={sendMessage} disabled={chatLoading || !chatInput.trim()} style={!chatLoading && chatInput.trim() ? btnPrimary : btnDisabled}>Send</button>
                    <button onClick={handleSynthesize} style={{ ...btnTertiary, marginLeft: 'auto', fontSize: 12 }}>End interview early</button>
                  </>
                )}
              </BtnRow>
            </div>
          </Card>
        )}

        {/* Screen 6: Synthesizing */}
        {screen === 'synthesizing' && (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={spinnerStyle} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Synthesizing your knowledge...</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Turning our conversation into structured Q&A entries</div>
            </div>
          </Card>
        )}

        {/* Screen 7: Synthesis review */}
        {screen === 'synthesis_review' && (
          <>
            <Card style={{ marginBottom: 12 }}>
              <StageLabel>Step 5 · Review &amp; approve</StageLabel>
              <h1 style={h1Style}>Here's what I learned from you</h1>
              <p style={subtitleStyle}>
                I've turned our conversation into {entryStates.length} knowledge entries. Approve, edit, or reject each one. Editing reverts an entry to pending.
              </p>
            </Card>

            {entryStates.map((es, idx) => (
              <EntryCard
                key={es.entry.entry_id || idx}
                state={es}
                onChange={(answer) =>
                  setEntryStates(prev => prev.map((s, i) =>
                    i === idx ? { ...s, answer, approval: 'pending' } : s
                  ))
                }
                onApprove={() =>
                  setEntryStates(prev => prev.map((s, i) =>
                    i === idx ? { ...s, approval: 'approved' } : s
                  ))
                }
                onReject={() =>
                  setEntryStates(prev => prev.map((s, i) =>
                    i === idx ? { ...s, approval: 'rejected' } : s
                  ))
                }
              />
            ))}

            {/* Transcript note */}
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--beige)', borderRadius: 6, fontSize: 12, color: 'var(--text-2)', borderLeft: '3px solid var(--text-3)' }}>
              Raw interview transcript stored internally for audit — never shown to students.
            </div>

            <BtnRow style={{ marginTop: 20 }}>
              <button onClick={() => setScreen('interview')} style={btnTertiary}>← Back</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || approvedCount === 0}
                style={approvedCount > 0 && !submitting ? btnSuccess : btnDisabled}
              >
                {submitting ? 'Submitting...' : `Submit ${approvedCount} approved entr${approvedCount === 1 ? 'y' : 'ies'} →`}
              </button>
            </BtnRow>
          </>
        )}

        {/* Screen 8: Done */}
        {screen === 'done' && (
          <Card style={{ textAlign: 'center', padding: '48px 28px' }}>
            <div style={{ width: 64, height: 64, background: 'var(--success-bg)', borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--success)' }}>
              ✓
            </div>
            <h1 style={h1Style}>You're all set, {draft.full_name.split(' ')[0]}!</h1>
            <p style={{ ...subtitleStyle, maxWidth: 520, margin: '0 auto 24px' }}>
              {approvedCount} {approvedCount === 1 ? 'entry is' : 'entries are'} pending admin review. Once published, students asking about your topics will get cited answers from your expertise.
            </p>
            <div style={{ background: 'var(--beige)', borderRadius: 8, padding: '16px 20px', maxWidth: 520, margin: '0 auto 24px', textAlign: 'left', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>What happens next</div>
              <ul style={{ color: 'var(--text-1)', lineHeight: 1.8, listStyle: 'none' }}>
                <li>• An admin will review and publish your entries.</li>
                <li>• Thoth will prompt you to refresh your knowledge in ~90 days.</li>
                <li>• Out-of-scope questions are routed automatically per your settings.</li>
                <li>• Log in anytime at <strong style={{ color: 'var(--wine)' }}>thoth.gix.uw.edu</strong> to update your entries.</li>
              </ul>
            </div>
            <BtnRow style={{ justifyContent: 'center' }}>
              <button onClick={() => router.push('/')} style={btnPrimary}>Back to home</button>
            </BtnRow>
          </Card>
        )}
      </div>

      {/* ── Bottom nav ── */}
      {screen !== 'extracting' && screen !== 'synthesizing' && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'white', borderRadius: 24, padding: '8px 12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', gap: 8,
          alignItems: 'center', zIndex: 100, border: '1px solid var(--border)'
        }}>
          <button
            disabled={screenIdx === 0}
            onClick={() => {
              const prev = SCREEN_ORDER[screenIdx - 1]
              if (prev) setScreen(prev)
            }}
            style={{ background: 'none', border: 'none', padding: '6px 14px', borderRadius: 16, cursor: 'pointer', fontSize: 13, color: 'var(--text-2)', opacity: screenIdx === 0 ? 0.3 : 1 }}
          >
            ← Back
          </button>
          <div style={{ display: 'flex', gap: 4, margin: '0 8px' }}>
            {SCREEN_ORDER.filter(s => s !== 'extracting' && s !== 'synthesizing').map((s, i) => {
              const filtered = SCREEN_ORDER.filter(sc => sc !== 'extracting' && sc !== 'synthesizing')
              const cur = filtered.indexOf(screen)
              const cls = i === cur ? 'active' : i < cur ? 'done' : ''
              return (
                <div key={s} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: cls === 'active' ? 'var(--wine)' : cls === 'done' ? 'var(--success)' : 'var(--border-strong)'
                }} />
              )
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginRight: 4 }}>
            {stageIndex + 1}/3
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function StageRibbon({ stageIndex }: { stageIndex: number }) {
  return (
    <div style={{ display: 'flex', gap: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
      {STAGES.map((s, i) => {
        const done = i < stageIndex
        const active = i === stageIndex
        return (
          <div key={s.label} style={{
            flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 12,
            textAlign: 'center', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: active ? 'var(--wine)' : 'transparent',
            color: active ? 'white' : done ? 'var(--text-1)' : 'var(--text-2)',
            fontWeight: active ? 500 : 400
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: '50%', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600,
              background: active ? 'white' : done ? 'var(--success)' : 'var(--border)',
              color: active ? 'var(--wine)' : done ? 'white' : 'var(--text-2)'
            }}>
              {done ? '✓' : i + 1}
            </span>
            {s.label}
          </div>
        )
      })}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 16, border: '1px solid var(--border)', ...style }}>
      {children}
    </div>
  )
}

function BtnRow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', ...style }}>{children}</div>
}

function StageLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8, fontWeight: 600 }}>{children}</div>
}

function EntryCard({ state, onChange, onApprove, onReject }: {
  state: EntryState
  onChange: (v: string) => void
  onApprove: () => void
  onReject: () => void
}) {
  const { entry, answer, approval } = state
  const [editing, setEditing] = useState(false)
  const tags = Array.isArray(entry.topic_tag) ? entry.topic_tag : [entry.topic_tag]

  return (
    <div style={{
      border: `1px solid ${approval === 'approved' ? '#C6E0B0' : editing ? 'var(--wine)' : 'var(--border)'}`,
      borderRadius: 10, padding: 18, marginBottom: 12,
      background: approval === 'approved' ? '#F8FCF4' : editing ? 'var(--wine-light)' : 'white'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 6 }}>
            {tags.map((tag, i) => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: i === 0 ? 'var(--wine)' : 'var(--wine-light)', color: i === 0 ? 'white' : 'var(--wine)', borderRadius: 12, fontSize: 12, margin: '3px 4px 3px 0', fontWeight: i === 0 ? 500 : 400 }}>
                {i === 0 ? '★' : '☆'} {TOPIC_BY_ID[tag]?.display || tag}
              </span>
            ))}
          </div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{entry.question_framing}</div>
        </div>
        <div>
          {approval === 'approved' && <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: 'var(--success-bg)', color: 'var(--success)' }}>Approved</span>}
          {approval === 'rejected' && <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: 'var(--danger-bg)', color: 'var(--danger)' }}>Rejected</span>}
          {approval === 'pending' && !entry.exposable_to_users && <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: '#FFF8EE', color: 'var(--warning)' }}>Route only</span>}
          {approval === 'pending' && entry.exposable_to_users && <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: 'var(--warning-bg)', color: 'var(--warning)' }}>Pending</span>}
        </div>
      </div>

      {editing ? (
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '12px 0 6px' }}>Synthesized answer</label>
          <textarea
            rows={4}
            value={answer}
            onChange={e => onChange(e.target.value)}
            style={{ ...textareaStyle, fontSize: 13 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => setEditing(false)} style={{ ...btnTertiary, padding: '6px 12px', fontSize: 12 }}>Cancel</button>
            <button onClick={() => { setEditing(false); onApprove() }} style={{ ...btnSuccess, padding: '6px 12px', fontSize: 12 }}>Save &amp; Approve</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6 }}>{answer}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', fontSize: 11, color: 'var(--text-2)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span>{entry.exposable_to_users ? '👁 Exposable to students' : '🔒 Internal only — students see routing message'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setEditing(true)} style={{ ...btnTertiary, padding: '6px 12px', fontSize: 12 }}>Edit</button>
            {approval !== 'approved' && (
              <button onClick={onApprove} style={{ ...btnSuccess, padding: '6px 12px', fontSize: 12 }}>✓ Approve</button>
            )}
            {approval !== 'rejected' && (
              <button onClick={onReject} style={{ ...btnDanger, padding: '6px 12px', fontSize: 12 }}>Reject</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared inline styles (mirrors prototype CSS tokens)
// ═══════════════════════════════════════════════════════════════════════════

const h1Style: React.CSSProperties = { fontSize: 22, fontWeight: 600, marginBottom: 8, color: 'var(--black, #000)', letterSpacing: -0.5 }
const h2Style: React.CSSProperties = { fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-1)' }
const subtitleStyle: React.CSSProperties = { color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }
const hintBoxStyle: React.CSSProperties = { background: 'var(--beige)', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }
const textareaStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid var(--border-strong)', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, background: 'white', resize: 'vertical', color: 'var(--text-1)', boxSizing: 'border-box' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', fontSize: 14, background: 'white', color: 'var(--text-1)', boxSizing: 'border-box' }
const colLabelStyle: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', marginBottom: 8, fontWeight: 600 }
const fieldLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }
const sourceBoxStyle: React.CSSProperties = { background: 'var(--beige)', padding: 14, borderRadius: 8, fontSize: 13, color: 'var(--text-1)', whiteSpace: 'pre-wrap', fontFamily: "'SF Mono', Monaco, monospace", lineHeight: 1.6, minHeight: 120 }
const chipAreaStyle: React.CSSProperties = { padding: 8, border: '1px solid var(--border)', borderRadius: 6, background: 'white', minHeight: 44 }
const chipStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'var(--wine-light)', color: 'var(--wine)', borderRadius: 12, fontSize: 12, margin: '3px 4px', cursor: 'pointer', border: '1px solid transparent' }
const chipPrimaryStyle: React.CSSProperties = { ...chipStyle, background: 'var(--wine)', color: 'white', fontWeight: 500 }
const btnPrimary: React.CSSProperties = { background: 'var(--tm-magenta)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }
const btnSuccess: React.CSSProperties = { background: 'var(--success)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }
const btnTertiary: React.CSSProperties = { background: 'white', color: 'var(--text-2)', border: '1px solid var(--border-strong)', padding: '10px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer' }
const btnDanger: React.CSSProperties = { background: 'white', color: 'var(--danger)', border: '1px solid #F7C1C1', padding: '10px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer' }
const btnDisabled: React.CSSProperties = { ...btnPrimary, opacity: 0.4, cursor: 'not-allowed' }
const errorStyle: React.CSSProperties = { marginTop: 10, padding: '10px 14px', background: 'var(--danger-bg)', borderLeft: '3px solid var(--danger)', borderRadius: 6, fontSize: 13, color: 'var(--danger)' }
const warningBoxStyle: React.CSSProperties = { padding: '10px 14px', background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning)', borderRadius: 6, fontSize: 13, color: 'var(--warning)' }
const spinnerStyle: React.CSSProperties = {
  display: 'block', width: 32, height: 32,
  border: '3px solid var(--border)', borderTopColor: 'var(--tm-magenta)',
  borderRadius: '50%', margin: '0 auto 12px',
  animation: 'spin 0.8s linear infinite'
}
