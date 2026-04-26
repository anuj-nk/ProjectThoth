// ============================================
// API: /api/sme/interview
// Conduct and save SME knowledge interviews
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { conductInterview, synthesizeKBEntry, generateEmbedding } from '@/lib/claude'
import { interviewApi, kbApi } from '@/lib/supabase'
import type { InterviewMessage } from '@/types'

// POST /api/sme/interview - Send a message in the interview
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, sme_id, topic, interview_id, message } = body

    // --- Start a new interview ---
    if (action === 'start') {
      if (!sme_id || !topic) {
        return NextResponse.json(
          { error: 'sme_id and topic required' },
          { status: 400 }
        )
      }

      // Create interview record
      const interview = await interviewApi.create(sme_id, topic)

      // Get first question from Claude
      const firstMessage = await conductInterview([], '')

      // Save first message
      const messages: InterviewMessage[] = [{
        role: 'assistant',
        content: firstMessage,
        timestamp: new Date().toISOString()
      }]

      await interviewApi.update(interview.id, { messages })

      return NextResponse.json({
        interview_id: interview.id,
        message: firstMessage,
        status: 'in_progress'
      })
    }

    // --- Continue interview ---
    if (action === 'message') {
      if (!interview_id || !message) {
        return NextResponse.json(
          { error: 'interview_id and message required' },
          { status: 400 }
        )
      }

      const interview = await interviewApi.getById(interview_id)
      if (!interview) {
        return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
      }

      // Add SME message to history
      const updatedMessages: InterviewMessage[] = [
        ...interview.messages,
        {
          role: 'sme',
          content: message,
          timestamp: new Date().toISOString()
        }
      ]

      // Get Claude's next response
      const assistantResponse = await conductInterview(updatedMessages, message)

      // Check if interview is complete
      const isComplete = assistantResponse.toLowerCase().includes('let me prepare a summary')
        || assistantResponse.toLowerCase().includes('solid understanding')

      const finalMessages: InterviewMessage[] = [
        ...updatedMessages,
        {
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date().toISOString()
        }
      ]

      await interviewApi.update(interview_id, {
        messages: finalMessages,
        status: isComplete ? 'completed' : 'in_progress',
        ...(isComplete && { completed_at: new Date().toISOString() })
      })

      return NextResponse.json({
        message: assistantResponse,
        status: isComplete ? 'completed' : 'in_progress',
        interview_id
      })
    }

    // --- Synthesize and create KB draft ---
    if (action === 'synthesize') {
      if (!interview_id || !sme_id) {
        return NextResponse.json(
          { error: 'interview_id and sme_id required' },
          { status: 400 }
        )
      }

      const interview = await interviewApi.getById(interview_id)
      if (!interview) {
        return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
      }

      // Synthesize with Claude
      const synthesis = await synthesizeKBEntry(interview.messages, interview.topic)

      // Create KB entry as draft
      const kbEntry = await kbApi.create({
        sme_id,
        topic: synthesis.topic,
        subtopic: synthesis.subtopic,
        title: synthesis.title,
        content: synthesis.content,
        raw_transcript: JSON.stringify(interview.messages), // stored but never shown to users
        status: 'pending_sme',                              // waiting for SME approval
        visibility: synthesis.visibility as 'internal' | 'user_visible',
        keywords: synthesis.keywords,
        confidence_hint: synthesis.confidence_hint,
        review_date: getReviewDate(synthesis.review_cadence)
      })

      // Link KB entry to interview
      await interviewApi.update(interview_id, { kb_entry_id: kbEntry.id })

      return NextResponse.json({
        kb_entry: kbEntry,
        synthesis,
        message: 'Knowledge entry synthesized. Please review and approve.'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Interview API error:', error)
    return NextResponse.json(
      { error: error.message || 'Interview failed' },
      { status: 500 }
    )
  }
}

// Helper: calculate review date based on cadence
function getReviewDate(cadence: string): string {
  const date = new Date()
  switch (cadence) {
    case 'monthly':    date.setMonth(date.getMonth() + 1); break
    case 'quarterly':  date.setMonth(date.getMonth() + 3); break
    case 'biannual':   date.setMonth(date.getMonth() + 6); break
    case 'annual':     date.setFullYear(date.getFullYear() + 1); break
    default:           date.setMonth(date.getMonth() + 6)
  }
  return date.toISOString().split('T')[0]
}
