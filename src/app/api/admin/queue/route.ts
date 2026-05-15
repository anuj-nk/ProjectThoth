// ============================================
// API: /api/admin/queue
// Admin queue — unhandled signals from query + intake flows
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { adminQueueApi } from '@/lib/supabase'

export async function GET() {
  try {
    const entries = await adminQueueApi.getPending()
    return NextResponse.json({ entries })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, queue_id, resolution, resolved_by } = body

    if (action === 'resolve') {
      if (!queue_id || !resolution) {
        return NextResponse.json({ error: 'queue_id and resolution required' }, { status: 400 })
      }
      const entry = await adminQueueApi.resolve(queue_id, resolution, resolved_by || 'admin')
      return NextResponse.json({ entry })
    }

    if (action === 'dismiss') {
      if (!queue_id) return NextResponse.json({ error: 'queue_id required' }, { status: 400 })
      const entry = await adminQueueApi.dismiss(queue_id)
      return NextResponse.json({ entry })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
