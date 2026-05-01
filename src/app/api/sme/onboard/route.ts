// ============================================
// API: /api/sme/onboard
// Create or retrieve a persistent SME profile
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { smeApi } from '@/lib/supabase'
import type { CreateSMEProfile } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { full_name, email, title, domain, topics, exclusions, routing_preferences } = body

    if (!full_name || !email || !domain) {
      return NextResponse.json(
        { error: 'full_name, email, and domain are required' },
        { status: 400 }
      )
    }

    // Check if SME already exists
    const existing = await smeApi.getByEmail(email)
    if (existing) {
      return NextResponse.json({
        profile: existing,
        created: false,
        message: 'Welcome back! Your profile has been loaded.'
      })
    }

    // Create new profile
    const profile = await smeApi.create({
      full_name,
      email,
      title: title || undefined,
      domain,
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
    // Return all SMEs (for admin/routing)
    const smes = await smeApi.getAll()
    return NextResponse.json({ smes })
  }

  const profile = await smeApi.getByEmail(email)
  if (!profile) {
    return NextResponse.json({ error: 'SME not found' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}
