import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { querySessionsApi } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    await querySessionsApi.deleteAll()
    return NextResponse.json({ status: 'reset', message: 'Session state cleared. SME profiles, interviews, materials, and knowledge entries preserved.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
