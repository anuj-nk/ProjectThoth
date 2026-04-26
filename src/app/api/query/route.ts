// ============================================
// API: /api/query
// Main user-facing query endpoint
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { handleUserQuery, generateEmbedding } from '@/lib/claude'
import { kbApi, smeApi, queryLogApi } from '@/lib/supabase'
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
    const threshold = parseFloat(process.env.NEXT_PUBLIC_CONFIDENCE_THRESHOLD || '0.75')
    const kbResults = await kbApi.semanticSearch(questionEmbedding, threshold - 0.1, 5)
    // Note: we search slightly below threshold to give Claude context even for borderline matches

    // Step 3: Get all active SMEs for routing
    const allSMEs = await smeApi.getAll()

    // Step 4: Let Claude decide what to do
    const result = await handleUserQuery(question, kbResults, allSMEs)

    // Step 5: Log the query for analytics
    await queryLogApi.log({
      session_id: sessionId,
      question,
      answer: result.answer,
      action_taken: result.action,
      kb_entries_used: result.kb_entries_used,
      sme_routed_to: result.routed_sme?.id,
      confidence_score: result.confidence_score
    })

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
