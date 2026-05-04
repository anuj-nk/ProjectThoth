'use client'

import { useState, useEffect } from 'react'
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
    <div style={{ minHeight: '100vh', background: '#F6F6F6' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 28px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, background: 'var(--tm-magenta)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: 17, flexShrink: 0 }}>T</div>
          <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-1)', letterSpacing: -0.4 }}>Project Thoth</span>
          <span style={{ color: 'var(--border-strong)', fontSize: 15 }}>—</span>
          <span style={{ color: 'var(--text-2)', fontSize: 15 }}>
            {session.role === 'sme' && `SME: ${session.sme_profile?.full_name}`}
            {session.role === 'admin' && 'Admin Dashboard'}
            {session.role === 'user' && 'Knowledge Portal'}
          </span>
        </div>
        <button
          onClick={() => setSession(null)}
          style={{ fontSize: 14, color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)', cursor: 'pointer', padding: '6px 14px', borderRadius: 20 }}
        >
          Switch Role
        </button>
      </header>

      <main>
        {session.role === 'user' && <UserChat sessionId={session.session_id} />}
        {session.role === 'sme' && session.sme_profile && <SMEOnboarding smeProfile={session.sme_profile} />}
        {session.role === 'admin' && <AdminDashboard />}
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
    onSelect({ role: 'user', session_id: uuidv4() })
  }

  const handleAdminSelect = () => {
    onSelect({ role: 'admin', session_id: uuidv4() })
  }

  const handleSMELogin = async () => {
    if (!smeEmail.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/sme/onboard?email=${encodeURIComponent(smeEmail)}`)
      const data = await res.json()
      if (data.profile) {
        onSelect({ role: 'sme', sme_profile: data.profile, session_id: uuidv4() })
      } else {
        setError('SME profile not found. Please complete onboarding first.')
      }
    } catch {
      setError('Failed to load profile. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const roles = [
    {
      key: 'user',
      icon: '💬',
      title: 'Ask a Question',
      desc: 'Find answers and get routed to the right expert.',
      cta: 'Enter as User',
      onClick: handleUserSelect,
    },
    {
      key: 'sme',
      icon: '🧠',
      title: 'SME Portal',
      desc: 'Share your expertise and build the knowledge base.',
      cta: 'Enter as SME',
      onClick: () => setShowSMELogin(!showSMELogin),
    },
    {
      key: 'admin',
      icon: '⚙️',
      title: 'Admin Dashboard',
      desc: 'Review entries, manage the KB, and view analytics.',
      cta: 'Enter as Admin',
      onClick: handleAdminSelect,
    },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F6F6F6',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 32px'
    }}>
      {/* Logo lockup */}
      <div style={{ marginBottom: 56, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, background: 'var(--tm-magenta)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: 28, margin: '0 auto 20px' }}>T</div>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-1)', letterSpacing: -0.6, marginBottom: 8 }}>Project Thoth</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>Knowledge Intelligence System</p>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6 }}>
          A <strong style={{ color: 'var(--tm-magenta)', fontWeight: 600 }}>T-Mobile</strong> × GIX Project
        </p>
      </div>

      {/* Role cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 260px)', gap: 16, marginBottom: 32 }}>
        {roles.map(role => (
          <button
            key={role.key}
            onClick={role.onClick}
            style={{
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 24,
              padding: '28px 24px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--tm-magenta)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 16px rgba(226,0,116,0.10)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: 26, marginBottom: 12 }}>{role.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-1)', marginBottom: 8 }}>{role.title}</div>
            <div style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>{role.desc}</div>
            <div style={{ fontSize: 14, color: 'var(--tm-magenta)', fontWeight: 600 }}>{role.cta} →</div>
          </button>
        ))}
      </div>

      {/* Post-registration banner */}
      {registered && (
        <div style={{ width: 360, marginBottom: 14, border: '1px solid #86EFAC', background: '#F0FDF4', borderRadius: 12, padding: '12px 16px' }}>
          <p style={{ fontSize: 15, color: '#15803D' }}>Profile created! Log in below with your email.</p>
        </div>
      )}

      {/* SME Login panel */}
      {showSMELogin && (
        <div style={{ width: 360, border: '1px solid var(--border)', borderRadius: 16, padding: 24, background: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 14 }}>Enter your SME email</div>
          <input
            type="email"
            value={smeEmail}
            onChange={e => setSmeEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSMELogin()}
            placeholder="your.email@gix.uw.edu"
            style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 15, color: 'var(--text-1)', boxSizing: 'border-box', marginBottom: 10, outline: 'none', background: 'white' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--tm-magenta)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
          />
          {error && (
            <div style={{ fontSize: 14, color: 'var(--danger)', background: 'var(--danger-bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSMELogin}
              disabled={loading}
              style={{ flex: 1, background: 'var(--tm-magenta)', color: 'white', border: 'none', borderRadius: 24, padding: '11px 0', fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Loading…' : 'Load Profile'}
            </button>
            <button
              onClick={() => { window.location.href = '/sme/register' }}
              style={{ flex: 1, background: 'white', color: 'var(--text-2)', border: '1px solid var(--border-strong)', borderRadius: 24, padding: '11px 0', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
            >
              New SME
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 36 }}>PoC Demo — Project Thoth v0.1</p>
    </div>
  )
}
