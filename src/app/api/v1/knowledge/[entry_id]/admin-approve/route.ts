import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { kbApi, kbV1Api } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/claude'

export async function POST(req: NextRequest, { params }: { params: Promise<{ entry_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { entry_id } = await params
    const entry = await kbApi.getById(entry_id)
    if (!entry) return NextResponse.json({ error: 'Entry not found', code: 'NOT_FOUND' }, { status: 404 })
    if (entry.status !== 'pending_review') {
      return NextResponse.json({ error: 'Invalid state transition: entry must be in sme_approved status (pending_review in DB)', code: 'INVALID_TRANSITION' }, { status: 409 })
    }

    // Generate embedding at admin-approve time (matches our two-tier flow)
    const embeddingText = `${entry.question_framing}\n${entry.synthesized_answer}`
    try {
      const embedding = await generateEmbedding(embeddingText)
      await kbApi.storeEmbedding(entry_id, embedding)
    } catch (embedErr) {
      console.error('[v1 admin-approve] Embedding failed (continuing):', embedErr)
    }

    const now = new Date().toISOString()
    await kbV1Api.adminApprove(entry_id)

    return NextResponse.json({ entry_id, status: 'approved', admin_approved_at: now })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
