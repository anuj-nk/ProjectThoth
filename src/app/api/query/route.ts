// ============================================
// API: /api/query
// Main user-facing query endpoint
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { handleUserQuery, generateEmbedding } from '@/lib/claude'
import { kbApi, smeApi, adminQueueApi } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, session_id } = body

    if (!question?.trim()) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    const sessionId = session_id || uuidv4()

    // Step 1: Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question)

    // Step 2: Semantic search against approved KB
    const threshold = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.75')
    const kbResults = await kbApi.semanticSearch(questionEmbedding, 0.3, 5)

    // Step 3: Get all SMEs for routing
    const allSMEs = await smeApi.getAll()

    // Step 4: Let Claude decide what to do
    const result = await handleUserQuery(question, kbResults, allSMEs)

    // Step 5: Push unhandled queries to admin queue
    if (result.action === 'routed_admin') {
      try {
        await adminQueueApi.create({
          source: 'user_query',
          signal_type: 'routed_admin',
          payload: {
            question,
            session_id: sessionId,
            kb_matches_found: kbResults.length,
            highest_similarity: kbResults[0]?.similarity || 0,
            confidence_score: result.confidence_score,
            routing_reason: result.routing_reason,
            user_visible_reason: result.answer || result.clarifying_question || 'Routed to admin'
          },
          topic_guess: kbResults[0]?.topic_tag
            ? Array.isArray(kbResults[0].topic_tag)
              ? kbResults[0].topic_tag[0]
              : kbResults[0].topic_tag
            : undefined,
          priority: kbResults.length === 0 ? 'high' : 'normal'
        })
      } catch (queueErr) {
        // Non-fatal: log but don't fail the user request
        console.error('Failed to enqueue admin signal:', queueErr)
      }
    }

    // Step 6: Query logging is planned for CI-2 (query_logs table not yet built)

    return NextResponse.json({
      result,
      session_id: sessionId,
      debug: {
        kb_matches_found: kbResults.length,
        highest_similarity: kbResults[0]?.similarity || 0,
        confidence_threshold: threshold
      }
    })

  } catch (error: any) {
    console.error('Query API error:', error)
    return NextResponse.json(
      { error: error.message || 'Query failed' },
      { status: 500 }
    )
  }
}
