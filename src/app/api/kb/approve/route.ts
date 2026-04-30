// ============================================
// API: /api/kb/approve
// SME and Admin approval workflow for KB entries
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { kbApi } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, kb_entry_id, sme_id, approved_by, edits } = body

    if (!kb_entry_id || !action) {
      return NextResponse.json(
        { error: 'kb_entry_id and action required' },
        { status: 400 }
      )
    }

    // --- SME approves their own entry → pending_review ---
    if (action === 'sme_approve') {
      if (!sme_id) {
        return NextResponse.json({ error: 'sme_id required for sme_approve' }, { status: 400 })
      }

      await kbApi.smeApprove(kb_entry_id, sme_id)

      if (edits?.synthesized_answer) {
        await kbApi.update(kb_entry_id, { synthesized_answer: edits.synthesized_answer })
      }

      const entry = await kbApi.getById(kb_entry_id)
      return NextResponse.json({ entry, message: 'Entry submitted for admin review.' })
    }

    // --- SME sends entry back to draft ---
    if (action === 'sme_reject') {
      const updates: Record<string, any> = { status: 'draft' }
      if (edits?.synthesized_answer) updates.synthesized_answer = edits.synthesized_answer
      const entry = await kbApi.update(kb_entry_id, updates)
      return NextResponse.json({ entry, message: 'Entry returned to draft for revision.' })
    }

    // --- Admin publishes entry → approved + embedding ---
    if (action === 'admin_approve') {
      if (!approved_by) {
        return NextResponse.json({ error: 'approved_by required' }, { status: 400 })
      }

      const entry = await kbApi.getById(kb_entry_id)
      if (!entry || entry.status !== 'pending_review') {
        return NextResponse.json(
          { error: 'Entry not found or not pending review' },
          { status: 404 }
        )
      }

      // Embed question_framing + synthesized_answer at publish time (per PRD)
      const textToEmbed = `${entry.question_framing}\n\n${entry.synthesized_answer}`
      const embedding = await generateEmbedding(textToEmbed)
      await kbApi.storeEmbedding(kb_entry_id, embedding)

      const approvedEntry = await kbApi.publish(kb_entry_id, approved_by)
      return NextResponse.json({
        entry: approvedEntry,
        message: 'Entry approved and published to knowledge base.'
      })
    }

    // --- Admin rejects entry ---
    if (action === 'admin_reject') {
      const entry = await kbApi.reject(kb_entry_id)
      return NextResponse.json({ entry, message: 'Entry rejected.' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Approval API error:', error)
    return NextResponse.json(
      { error: error.message || 'Approval failed' },
      { status: 500 }
    )
  }
}

// GET pending entries (for admin dashboard and SME review)
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status')
    const sme_id = req.nextUrl.searchParams.get('sme_id')

    if (status === 'pending_review') {
      const entries = await kbApi.getPendingAdmin()
      return NextResponse.json({ entries })
    }

    if (sme_id) {
      const entries = await kbApi.getBySME(sme_id)
      return NextResponse.json({ entries })
    }

    const dueForReview = await kbApi.getDueForReview()
    return NextResponse.json({ entries: dueForReview })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
