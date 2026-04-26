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
    const { action, kb_entry_id, approved_by, edits } = body

    if (!kb_entry_id || !action) {
      return NextResponse.json(
        { error: 'kb_entry_id and action required' },
        { status: 400 }
      )
    }

    // --- SME approves their own entry ---
    if (action === 'sme_approve') {
      const entry = await kbApi.update(kb_entry_id, {
        status: 'pending_admin',
        ...(edits && { content: edits.content, keywords: edits.keywords })
      })

      return NextResponse.json({
        entry,
        message: 'Entry submitted for admin review.'
      })
    }

    // --- SME requests changes (sends back to draft) ---
    if (action === 'sme_reject') {
      const entry = await kbApi.update(kb_entry_id, {
        status: 'draft',
        ...(edits && { content: edits.content })
      })

      return NextResponse.json({
        entry,
        message: 'Entry returned to draft for revision.'
      })
    }

    // --- Admin approves and publishes to KB ---
    if (action === 'admin_approve') {
      if (!approved_by) {
        return NextResponse.json({ error: 'approved_by required' }, { status: 400 })
      }

      // Get the entry to generate embedding
      const entries = await kbApi.getPendingAdmin()
      const entry = entries.find(e => e.id === kb_entry_id)

      if (!entry) {
        return NextResponse.json({ error: 'Entry not found or not pending' }, { status: 404 })
      }

      // Generate embedding from title + content
      const textToEmbed = `${entry.title}\n\n${entry.content}\n\nKeywords: ${entry.keywords.join(', ')}`
      const embedding = await generateEmbedding(textToEmbed)

      // Store embedding
      await kbApi.storeEmbedding(kb_entry_id, embedding)

      // Approve entry
      const approvedEntry = await kbApi.approve(kb_entry_id, approved_by)

      return NextResponse.json({
        entry: approvedEntry,
        message: 'Entry approved and published to knowledge base.'
      })
    }

    // --- Admin rejects ---
    if (action === 'admin_reject') {
      const entry = await kbApi.update(kb_entry_id, {
        status: 'pending_sme'
      })

      return NextResponse.json({
        entry,
        message: 'Entry returned to SME for revision.'
      })
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

// GET pending entries (for admin dashboard)
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status')
    const sme_id = req.nextUrl.searchParams.get('sme_id')

    if (status === 'pending_admin') {
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
