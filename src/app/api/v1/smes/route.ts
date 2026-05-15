import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { smeApi } from '@/lib/supabase'
import { dbSmeToSpec } from '@/lib/v1-mappers'
import { getDomainValues, normalizeDomainFromDb } from '@/lib/taxonomy-db'

export async function POST(req: NextRequest) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const body = await req.json()
    const { name, specialization, sub_areas, contact_email } = body

    if (!name || !specialization || !sub_areas || !contact_email) {
      return NextResponse.json({ error: 'Missing required fields: name, specialization, sub_areas, contact_email', code: 'MISSING_FIELDS' }, { status: 400 })
    }

    // P7: normalize `specialization` (which the benchmark sends as a
    // display-form string like "Career Services" or "Student Wellbeing")
    // into the canonical DB enum to avoid sme_profiles_domain_check 500s.
    const canonicalDomain = await normalizeDomainFromDb(specialization)
    if (!canonicalDomain) {
      const domains = await getDomainValues()
      return NextResponse.json(
        {
          error: `Invalid specialization "${specialization}". Allowed canonical values: ${domains.join(', ')}`,
          code: 'INVALID_DOMAIN',
        },
        { status: 400 }
      )
    }

    const row = await smeApi.create({
      full_name: name,
      domain: canonicalDomain,
      topics: Array.isArray(sub_areas) ? sub_areas : [sub_areas],
      email: contact_email,
      exclusions: [],
      routing_preferences: [],
    })

    return NextResponse.json(dbSmeToSpec(row), { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const rows = await smeApi.getAll()
    return NextResponse.json({ smes: rows.map(dbSmeToSpec) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
