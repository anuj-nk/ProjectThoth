import { NextRequest, NextResponse } from 'next/server'
import { getActiveDomainsFromDb, getTopicsByDomainFromDb } from '@/lib/taxonomy-db'

export async function GET(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get('domain') || undefined
    const [domains, topics] = await Promise.all([
      getActiveDomainsFromDb(),
      getTopicsByDomainFromDb(domain, true),
    ])

    return NextResponse.json({ domains, topics })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load taxonomy' },
      { status: 500 }
    )
  }
}
