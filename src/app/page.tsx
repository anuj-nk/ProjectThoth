'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageSquare, BookOpen, Send, CheckCircle } from 'lucide-react'
import UserChat from '@/components/user/UserChat'
import SMEOnboarding from '@/components/sme/SMEOnboarding'
import AdminDashboard from '@/components/admin/AdminDashboard'
import type { AppSession } from '@/types'
import { v4 as uuidv4 } from 'uuid'

// ============================================
// App Shell (post-login)
// ============================================
export default function Home() {
  const [session, setSession] = useState<AppSession | null>(null)

  if (!session) {
    return <Landing onSelect={setSession} />
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b border-ink-100
                         flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-magenta-500 rounded-md flex items-center justify-center shrink-0">
            <span className="text-white font-black text-base leading-none">T</span>
          </div>
          <span className="font-bold text-ink-900 text-lg tracking-tight">Project Thoth</span>
          <span className="text-ink-300 mx-1">—</span>
          <span className="text-ink-500 text-sm">
            {session.role === 'sme'   && `SME: ${session.sme_profile?.full_name}`}
            {session.role === 'admin' && 'Admin Dashboard'}
            {session.role === 'user'  && 'Knowledge Portal'}
          </span>
        </div>
        <button
          onClick={() => setSession(null)}
          className="text-sm text-ink-500 border border-ink-200 rounded-full px-4 py-1.5
                     hover:border-ink-400 hover:text-ink-900 transition-all duration-150"
        >
          Switch Role
        </button>
      </header>

      <main>
        {session.role === 'user'  && <UserChat sessionId={session.session_id} />}
        {session.role === 'sme'   && session.sme_profile && <SMEOnboarding smeProfile={session.sme_profile} />}
        {session.role === 'admin' && <AdminDashboard />}
      </main>
    </div>
  )
}

// ============================================
// Landing
// ============================================
function Landing({ onSelect }: { onSelect: (s: AppSession) => void }) {
  const [smeOpen, setSmeOpen] = useState(false)
  const [smeEmail, setSmeEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('registered=1')) {
      setRegistered(true)
      setSmeOpen(true)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  useEffect(() => {
    if (smeOpen) setTimeout(() => inputRef.current?.focus(), 120)
  }, [smeOpen])

  const handleLearn = () => onSelect({ role: 'user', session_id: uuidv4() })
  const handleAdmin = () => onSelect({ role: 'admin', session_id: uuidv4() })

  const handleSMELogin = async () => {
    if (!smeEmail.trim()) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/sme/onboard?email=${encodeURIComponent(smeEmail)}`)
      const data = await res.json()
      if (data.profile) {
        onSelect({ role: 'sme', sme_profile: data.profile, session_id: uuidv4() })
      } else {
        setError('No SME profile found for this email.')
      }
    } catch {
      setError('Failed to load profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b border-ink-100
                         flex items-center justify-between px-6 md:px-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-magenta-500 rounded-md flex items-center justify-center shrink-0">
            <span className="text-white font-black text-base leading-none">T</span>
          </div>
          <span className="font-bold text-ink-900 text-lg tracking-tight">Project Thoth</span>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-green-500" />
            </span>
            <span className="text-xs text-ink-500 font-medium">System Status: Online</span>
          </div>
          <div className="w-px h-4 bg-ink-200 hidden sm:block" />
          <button
            onClick={handleAdmin}
            className="text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors duration-150"
          >
            Admin Login →
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex items-center justify-center px-6 md:px-10 py-12">
        <div className="w-full max-w-6xl">

          {/* Hero */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold tracking-tight text-ink-900 leading-tight">
              Hi, I&apos;m Thoth.
            </h1>
            <p className="text-xl text-ink-600 mt-4 leading-relaxed max-w-2xl mx-auto">
              I&apos;m your intelligent knowledge assistant, here to provide grounded answers
              or help you share your expertise with the team.
            </p>

            {/* PoC disclaimer */}
            <div className="mt-5 inline-block bg-magenta-50 rounded-lg px-4 py-2.5">
              <p className="text-sm text-magenta-700 font-medium">
                PoC Demo — Project Thoth v0.1 &middot; GIX × T-Mobile internal preview
              </p>
            </div>
          </div>

          {/* ── 2-col tile grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">

            {/* Card A — Learn */}
            <div className="bg-white border border-ink-200 rounded-[32px] p-10 shadow-sm
                            hover:border-magenta-500 transition-all duration-200 flex flex-col">
              <div className="size-12 rounded-xl bg-magenta-50 flex items-center justify-center mb-6 shrink-0">
                <MessageSquare className="size-6 text-magenta-500" strokeWidth={1.75} />
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-ink-900 mb-3">
                I&apos;m here to learn.
              </h2>
              <p className="text-sm text-ink-500 mb-5 leading-relaxed">
                Get instant, cited answers from the GIX knowledge base — or be connected directly to the right expert.
              </p>

              <ul className="space-y-2.5 mb-8 flex-1">
                {[
                  'GIX Program Details',
                  'Career Resources & CPT / OPT',
                  'Admissions & Scholarships',
                  'Facilities & Prototyping Lab',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-ink-700">
                    <CheckCircle className="size-4 text-magenta-500 shrink-0" strokeWidth={2} />
                    {item}
                  </li>
                ))}
              </ul>

              <button
                onClick={handleLearn}
                className="w-full py-3.5 rounded-full bg-magenta-500 text-white font-semibold text-base
                           hover:bg-magenta-600 active:scale-[0.98] transition-all duration-150"
              >
                Start Asking
              </button>
            </div>

            {/* Card B — Contribute */}
            <div className="bg-white border border-ink-200 rounded-[32px] p-10 shadow-sm
                            hover:border-magenta-500 transition-all duration-200 flex flex-col">
              <div className="size-12 rounded-xl bg-magenta-50 flex items-center justify-center mb-6 shrink-0">
                <BookOpen className="size-6 text-magenta-500" strokeWidth={1.75} />
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-ink-900 mb-3">
                I&apos;m here to contribute.
              </h2>
              <p className="text-sm text-ink-500 mb-5 leading-relaxed">
                Share your expertise through AI-guided interviews. Your knowledge becomes searchable, cited answers for the GIX community.
              </p>

              <ul className="space-y-2.5 mb-8 flex-1">
                {[
                  'AI-guided interview session',
                  'Review & approve synthesized entries',
                  'Update the knowledge base anytime',
                  'Track coverage across topics',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-ink-700">
                    <CheckCircle className="size-4 text-magenta-500 shrink-0" strokeWidth={2} />
                    {item}
                  </li>
                ))}
              </ul>

              {/* Inline SME login */}
              {!smeOpen ? (
                <button
                  onClick={() => setSmeOpen(true)}
                  className="w-full py-3.5 rounded-full border border-ink-300 text-ink-800 font-semibold text-base
                             hover:border-magenta-500 hover:text-magenta-600 active:scale-[0.98] transition-all duration-150"
                >
                  Enter as SME
                </button>
              ) : (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
                  {registered && (
                    <p className="text-xs text-green-700 font-medium mb-1">Profile created! Log in below.</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="email"
                      value={smeEmail}
                      onChange={e => setSmeEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSMELogin()}
                      placeholder="your.email@gix.uw.edu"
                      className="flex-1 min-w-0 px-4 py-3 rounded-full border border-ink-300 bg-white
                                 text-ink-900 placeholder:text-ink-400 text-sm
                                 focus:outline-none focus:border-magenta-500 focus:ring-2 focus:ring-magenta-500/20
                                 transition-all duration-150"
                    />
                    <button
                      onClick={handleSMELogin}
                      disabled={loading || !smeEmail.trim()}
                      className="size-11 shrink-0 rounded-full bg-magenta-500 text-white
                                 hover:bg-magenta-600 transition-colors duration-150
                                 disabled:opacity-40 disabled:cursor-wait flex items-center justify-center"
                    >
                      <Send className="size-4" strokeWidth={2} />
                    </button>
                  </div>
                  {error && <p className="text-xs text-red-600 px-1">{error}</p>}
                  <button
                    onClick={() => { window.location.href = '/sme/register' }}
                    className="text-xs text-ink-400 hover:text-magenta-500 transition-colors duration-150 text-left px-1 mt-1"
                  >
                    First time? Register as SME →
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="shrink-0 pb-2">
        <p className="text-center text-xs text-ink-400 py-4">
          PoC Demo — Project Thoth v0.1. Demoing GIX content for T-Mobile internal PoC.
        </p>
        <div className="h-1.5 bg-magenta-500 w-full" />
      </footer>

    </div>
  )
}
