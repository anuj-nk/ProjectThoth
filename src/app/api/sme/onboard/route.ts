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
    const { email, name, role, contact_info, topics_owned, topics_not_owned } = body

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: 'email, name, and role are required' },
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
      email,
      name,
      role,
      contact_info: contact_info || {},
      topics_owned: topics_owned || [],
      topics_not_owned: topics_not_owned || [],
      availability: 'available',
      is_active: true
    } as CreateSMEProfile)

    return NextResponse.json({
      profile,
      created: true,
      message: `Welcome, ${name}! Your SME profile has been created.`
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
