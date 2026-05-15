import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { kbV1Api } from '@/lib/supabase'
import { dbEntryToSpec, specStatusToDb } from '@/lib/v1-mappers'

export async function GET(req: NextRequest) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const specStatus = searchParams.get('status')
    const dbStatus = specStatus ? specStatusToDb(specStatus) : undefined
    const rows = await kbV1Api.getAll(dbStatus)
    return NextResponse.json({ entries: rows.map(dbEntryToSpec) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
