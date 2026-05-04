import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { smeApi } from '@/lib/supabase'
import { dbSmeToSpec } from '@/lib/v1-mappers'

export async function GET(req: NextRequest, { params }: { params: Promise<{ sme_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { sme_id } = await params
    const row = await smeApi.getById(sme_id)
    if (!row) return NextResponse.json({ error: 'SME not found', code: 'NOT_FOUND' }, { status: 404 })
    return NextResponse.json(dbSmeToSpec(row))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
