import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { kbApi, kbV1Api } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: Promise<{ entry_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { entry_id } = await params
    const entry = await kbApi.getById(entry_id)
    if (!entry) return NextResponse.json({ error: 'Entry not found', code: 'NOT_FOUND' }, { status: 404 })
    if (entry.status === 'rejected') {
      return NextResponse.json({ error: 'Entry is already rejected', code: 'INVALID_TRANSITION' }, { status: 409 })
    }

    const body = await req.json().catch(() => ({}))
    const now = new Date().toISOString()
    await kbV1Api.reject(entry_id, body.reason)

    return NextResponse.json({ entry_id, status: 'rejected', rejected_at: now })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
