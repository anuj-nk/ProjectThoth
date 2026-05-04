import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { kbApi } from '@/lib/supabase'
import { dbEntryToSpec } from '@/lib/v1-mappers'

export async function GET(req: NextRequest, { params }: { params: Promise<{ entry_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { entry_id } = await params
    const row = await kbApi.getById(entry_id)
    if (!row) return NextResponse.json({ error: 'Entry not found', code: 'NOT_FOUND' }, { status: 404 })
    return NextResponse.json(dbEntryToSpec(row))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ entry_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { entry_id } = await params
    const body = await req.json()
    if (!body.content) return NextResponse.json({ error: 'Missing required field: content', code: 'MISSING_FIELDS' }, { status: 400 })

    const existing = await kbApi.getById(entry_id)
    if (!existing) return NextResponse.json({ error: 'Entry not found', code: 'NOT_FOUND' }, { status: 404 })

    const row = await kbApi.update(entry_id, { synthesized_answer: body.content, updated_at: new Date().toISOString() })
    return NextResponse.json(dbEntryToSpec(row))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
