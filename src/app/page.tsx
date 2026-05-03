'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import UserChat from '@/components/user/UserChat'
import SMEOnboarding from '@/components/sme/SMEOnboarding'
import AdminDashboard from '@/components/admin/AdminDashboard'
import type { AppRole, AppSession, SMEProfile } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export default function Home() {
  const [session, setSession] = useState<AppSession | null>(null)

  if (!session) {
    return <RoleSelector onSelect={setSession} />
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#e20074] rounded flex items-center justify-center font-bold text-white text-sm">T</div>
          <span className="text-white font-semibold tracking-wide">Project Thoth</span>
          <span className="text-white/30 text-sm">— Knowledge Intelligence System</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/40 text-xs uppercase tracking-widest">
            {session.role === 'sme' && `SME: ${session.sme_profile?.full_name}`}
            {session.role === 'admin' && 'Admin Dashboard'}
            {session.role === 'user' && 'Knowledge Portal'}
          </span>
          <button
            onClick={() => setSession(null)}
            className="text-white/30 hover:text-white/70 text-xs transition-colors"
          >
            Switch Role
          </button>
        </div>
      </header>

      {/* Main content */}
      <main>
        {session.role === 'user' && (
          <UserChat sessionId={session.session_id} />
        )}
        {session.role === 'sme' && session.sme_profile && (
          <SMEOnboarding smeProfile={session.sme_profile} />
        )}
        {session.role === 'admin' && (
          <AdminDashboard />
        )}
      </main>
    </div>
  )
}

// ============================================
// Role Selector Screen
// ============================================
function RoleSelector({ onSelect }: { onSelect: (session: AppSession) => void }) {
  const [loading, setLoading] = useState(false)
  const [smeEmail, setSmeEmail] = useState('')
  const [showSMELogin, setShowSMELogin] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('registered=1')) {
      setRegistered(true)
      setShowSMELogin(true)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const handleUserSelect = () => {
    onSelect({
      role: 'user',
      session_id: uuidv4()
    })
  }

  const handleAdminSelect = () => {
    onSelect({
      role: 'admin',
      session_id: uuidv4()
    })
  }

  const handleSMELogin = async () => {
    if (!smeEmail.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/sme/onboard?email=${encodeURIComponent(smeEmail)}`)
      const data = await res.json()

      if (data.profile) {
        onSelect({
          role: 'sme',
          sme_profile: data.profile,
          session_id: uuidv4()
        })
      } else {
        setError('SME profile not found. Please complete onboarding first.')
      }
    } catch {
      setError('Failed to load profile. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8">
      {/* Logo */}
      <div className="mb-12 text-center">
        <div className="w-16 h-16 bg-[#e20074] rounded-xl flex items-center justify-center font-bold text-white text-2xl mx-auto mb-4">T</div>
        <h1 className="text-white text-3xl font-light tracking-[0.15em] mb-2">PROJECT THOTH</h1>
        <p className="text-white/40 text-sm tracking-widest uppercase">Knowledge Intelligence System</p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl mb-8">
        {/* User */}
        <button
          onClick={handleUserSelect}
          className="group border border-white/10 hover:border-[#e20074]/60 rounded-xl p-6 text-left transition-all duration-200 hover:bg-white/5"
        >
          <div className="text-2xl mb-3">💬</div>
          <h3 className="text-white font-medium mb-2">Ask a Question</h3>
          <p className="text-white/40 text-sm leading-relaxed">
            Find answers and get routed to the right expert.
          </p>
          <div className="mt-4 text-[#e20074] text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            Enter as User →
          </div>
        </button>

        {/* SME */}
        <button
          onClick={() => setShowSMELogin(!showSMELogin)}
          className="group border border-white/10 hover:border-[#e20074]/60 rounded-xl p-6 text-left transition-all duration-200 hover:bg-white/5"
        >
          <div className="text-2xl mb-3">🧠</div>
          <h3 className="text-white font-medium mb-2">SME Portal</h3>
          <p className="text-white/40 text-sm leading-relaxed">
            Share your expertise and build the knowledge base.
          </p>
          <div className="mt-4 text-[#e20074] text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            Enter as SME →
          </div>
        </button>

        {/* Admin */}
        <button
          onClick={handleAdminSelect}
          className="group border border-white/10 hover:border-[#e20074]/60 rounded-xl p-6 text-left transition-all duration-200 hover:bg-white/5"
        >
          <div className="text-2xl mb-3">⚙️</div>
          <h3 className="text-white font-medium mb-2">Admin Dashboard</h3>
          <p className="text-white/40 text-sm leading-relaxed">
            Review entries, manage the KB, and view analytics.
          </p>
          <div className="mt-4 text-[#e20074] text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            Enter as Admin →
          </div>
        </button>
      </div>

      {/* Post-registration banner */}
      {registered && (
        <div className="w-full max-w-sm mb-4 border border-emerald-500/30 bg-emerald-500/10 rounded-xl px-4 py-3">
          <p className="text-emerald-400 text-sm">Profile created! Log in below with your email.</p>
        </div>
      )}

      {/* SME Login panel */}
      {showSMELogin && (
        <div className="w-full max-w-sm border border-white/10 rounded-xl p-6 bg-white/5">
          <h4 className="text-white text-sm font-medium mb-4">Enter your SME email</h4>
          <input
            type="email"
            value={smeEmail}
            onChange={e => setSmeEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSMELogin()}
            placeholder="your.email@company.com"
            className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#e20074]/60 mb-3"
          />
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSMELogin}
              disabled={loading}
              className="flex-1 bg-[#e20074] hover:bg-[#c4005f] text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load Profile'}
            </button>
            <button
              onClick={() => {
                // For new SMEs - redirect to onboarding
                window.location.href = '/sme/register'
              }}
              className="flex-1 border border-white/20 hover:border-white/40 text-white/60 hover:text-white rounded-lg py-2.5 text-sm transition-colors"
            >
              New SME
            </button>
          </div>
        </div>
      )}

      <p className="text-white/20 text-xs mt-8">PoC Demo — Project Thoth v0.1</p>
    </div>
  )
}
