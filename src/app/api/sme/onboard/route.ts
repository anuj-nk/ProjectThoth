// ============================================
// API: /api/sme/onboard
// Actions:
//   POST { action: 'extract', raw_input }  → draft profile (no DB write)
//   POST { action: 'create', ...fields }   → save profile to DB
//   POST { ...fields } (no action)         → create profile (legacy)
//   GET  ?email=                           → fetch by email
//   GET  (no params)                       → list all SMEs
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { smeApi } from '@/lib/supabase'
import { extractProfile } from '@/lib/claude'
import { getDomainValues, normalizeDomainFromDb, normalizeTopicsFromDb } from '@/lib/taxonomy-db'
import type { CreateSMEProfile } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    // --- LLM profile extraction (no DB write) ---
    if (action === 'extract') {
      const { raw_input } = body
      if (!raw_input?.trim()) {
        return NextResponse.json({ error: 'raw_input required' }, { status: 400 })
      }

      const domains = await getDomainValues()
      const draft = await extractProfile(raw_input, domains)
      const canonicalDomain = await normalizeDomainFromDb(draft.domain) ?? 'other'

      // Normalize extracted topics against controlled vocabulary
      const rawTopics: string[] = draft.topics || []
      const { matched, unmatched } = await normalizeTopicsFromDb(rawTopics, canonicalDomain)

      return NextResponse.json({
        draft_profile: {
          ...draft,
          domain: canonicalDomain,
          topics: matched,         // taxonomy IDs
          raw_topics: rawTopics,   // original strings before normalization
        },
        unmatched_topics: unmatched,  // caller should surface to user
      })
    }

    // --- Create / upsert SME profile ---
    const { full_name, email, title, domain, topics, exclusions, routing_preferences } = body

    if (!full_name || !email || !domain) {
      return NextResponse.json(
        { error: 'full_name, email, and domain are required' },
        { status: 400 }
      )
    }

    // P7: normalize domain before insert so display-form values
    // ("Career Services") don't trip the Postgres CHECK constraint.
    const canonicalDomain = await normalizeDomainFromDb(domain)
    if (!canonicalDomain) {
      const domains = await getDomainValues()
      return NextResponse.json(
        {
          error: `Invalid domain "${domain}". Allowed values: ${domains.join(', ')}`,
          code: 'INVALID_DOMAIN',
        },
        { status: 400 }
      )
    }

    const existing = await smeApi.getByEmail(email)
    if (existing) {
      return NextResponse.json({
        profile: existing,
        created: false,
        message: 'Welcome back! Your profile has been loaded.'
      })
    }

    const profile = await smeApi.create({
      full_name,
      email,
      title: title || undefined,
      domain: canonicalDomain,
      topics: topics || [],
      exclusions: exclusions || [],
      routing_preferences: routing_preferences || [],
      availability: 'available',
    } as CreateSMEProfile)

    return NextResponse.json({
      profile,
      created: true,
      message: `Welcome, ${full_name}! Your SME profile has been created.`
    })
  } catch (error: any) {
    console.error('SME onboard error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create profile' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')

  if (!email) {
    const smes = await smeApi.getAll()
    return NextResponse.json({ smes })
  }

  const profile = await smeApi.getByEmail(email)
  if (!profile) {
    return NextResponse.json({ error: 'SME not found' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}
