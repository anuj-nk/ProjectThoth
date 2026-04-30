'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SMEProfile } from '@/types'

type Channel = 'email' | 'teams' | 'scheduling_link' | 'in_person'
type Domain = SMEProfile['domain']

const DOMAIN_OPTIONS: { value: Domain; label: string }[] = [
  { value: 'academics', label: 'Academics' },
  { value: 'career_services', label: 'Career Services' },
  { value: 'facilities', label: 'Facilities' },
  { value: 'prototyping_lab', label: 'Prototyping Lab' },
  { value: 'admissions', label: 'Admissions' },
  { value: 'it_purchasing', label: 'IT & Purchasing' },
  { value: 'student_wellbeing', label: 'Student Wellbeing' },
  { value: 'other', label: 'Other' },
]

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'scheduling_link', label: 'Scheduling Link' },
  { value: 'in_person', label: 'In Person' },
]

export default function SMERegisterPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [domain, setDomain] = useState<Domain | ''>('')
  const [topicsRaw, setTopicsRaw] = useState('')
  const [exclusionsRaw, setExclusionsRaw] = useState('')
  const [channels, setChannels] = useState<Channel[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleChannel = (channel: Channel) => {
    setChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !domain) {
      setError('Full name, email, and domain are required.')
      return
    }
    setError('')
    setLoading(true)

    const topics = topicsRaw
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const exclusions = exclusionsRaw
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const routing_preferences = channels.map((channel, i) => ({
      channel,
      priority: i + 1,
    }))

    try {
      const res = await fetch('/api/sme/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          title: title.trim() || undefined,
          domain,
          topics,
          exclusions,
          routing_preferences,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.')
        return
      }

      if (data.created === false) {
        setError('An SME with this email already exists. Please log in instead.')
        return
      }

      router.push('/?registered=1')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8">
      {/* Logo / header */}
      <div className="mb-10 text-center">
        <div className="w-12 h-12 bg-[#e20074] rounded-xl flex items-center justify-center font-bold text-white text-xl mx-auto mb-3">T</div>
        <h1 className="text-white text-2xl font-light tracking-[0.1em]">SME Registration</h1>
        <p className="text-white/40 text-sm mt-1">Create your Subject Matter Expert profile</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl space-y-8"
      >
        {/* Section: Identity */}
        <section>
          <h2 className="text-white/40 text-xs uppercase tracking-widest mb-4">Your Identity</h2>
          <div className="space-y-3">
            <div>
              <label className="text-white/60 text-xs uppercase tracking-widest block mb-1.5">
                Full Name <span className="text-[#e20074]">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#e20074]/60"
              />
            </div>

            <div>
              <label className="text-white/60 text-xs uppercase tracking-widest block mb-1.5">
                Email <span className="text-[#e20074]">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@gix.uw.edu"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#e20074]/60"
              />
            </div>

            <div>
              <label className="text-white/60 text-xs uppercase tracking-widest block mb-1.5">Title / Role</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Career Services Advisor"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#e20074]/60"
              />
            </div>

            <div>
              <label className="text-white/60 text-xs uppercase tracking-widest block mb-1.5">
                Domain <span className="text-[#e20074]">*</span>
              </label>
              <select
                value={domain}
                onChange={e => setDomain(e.target.value as Domain)}
                className="w-full bg-[#0a0a0a] border border-white/20 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#e20074]/60 appearance-none"
              >
                <option value="" disabled className="text-white/30">Select a domain…</option>
                {DOMAIN_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-[#0a0a0a] text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Section: Knowledge Areas */}
        <section>
          <h2 className="text-white/40 text-xs uppercase tracking-widest mb-4">Knowledge Areas</h2>
          <div className="space-y-3">
            <div>
              <label className="text-white/60 text-xs uppercase tracking-widest block mb-1.5">Topics you can answer</label>
              <input
                type="text"
                value={topicsRaw}
                onChange={e => setTopicsRaw(e.target.value)}
                placeholder="Internships, Resume Review, Job Search Strategy"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#e20074]/60"
              />
              <p className="text-white/25 text-xs mt-1">Separate topics with commas</p>
            </div>

            <div>
              <label className="text-white/60 text-xs uppercase tracking-widest block mb-1.5">Topics to exclude</label>
              <input
                type="text"
                value={exclusionsRaw}
                onChange={e => setExclusionsRaw(e.target.value)}
                placeholder="Salary Negotiations, Legal Questions"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#e20074]/60"
              />
              <p className="text-white/25 text-xs mt-1">Topics you should not be routed for</p>
            </div>
          </div>
        </section>

        {/* Section: Contact Preferences */}
        <section>
          <h2 className="text-white/40 text-xs uppercase tracking-widest mb-4">Contact Preferences</h2>
          <p className="text-white/30 text-xs mb-3">Select how students can reach you (ordered by priority)</p>
          <div className="grid grid-cols-2 gap-2">
            {CHANNEL_OPTIONS.map(opt => {
              const selected = channels.includes(opt.value)
              const priority = channels.indexOf(opt.value) + 1
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleChannel(opt.value)}
                  className={`flex items-center justify-between border rounded-lg px-4 py-3 text-sm transition-all ${
                    selected
                      ? 'border-[#e20074]/60 bg-[#e20074]/10 text-white'
                      : 'border-white/20 bg-white/5 text-white/50 hover:border-white/40 hover:text-white/70'
                  }`}
                >
                  <span>{opt.label}</span>
                  {selected && (
                    <span className="text-[#e20074] text-xs font-medium ml-2">#{priority}</span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm border border-red-400/30 bg-red-400/10 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex-1 border border-white/20 hover:border-white/40 text-white/50 hover:text-white rounded-lg py-3 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-[#e20074] hover:bg-[#c4005f] disabled:opacity-40 text-white rounded-lg py-3 text-sm font-medium transition-colors"
          >
            {loading ? 'Creating Profile…' : 'Create Profile'}
          </button>
        </div>

        <p className="text-center text-white/20 text-xs">
          Already registered?{' '}
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-white/40 hover:text-white underline transition-colors"
          >
            Log in from the home page
          </button>
        </p>
      </form>
    </div>
  )
}
