// ============================================
// API: /api/sme/interview
// Conduct and save SME knowledge interviews
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { conductInterview, synthesizeKBEntries } from '@/lib/claude'
import { interviewApi, kbApi, transcriptApi, smeApi } from '@/lib/supabase'
import type { InterviewMessage } from '@/types'

function loadSeedQuestions(domain: string = 'career_services'): string {
  const fileName = `${domain}.yaml`
  const seedPath = path.join(process.cwd(), 'src/data/seed_questions', fileName)
  const fallbackPath = path.join(process.cwd(), 'src/data/seed_questions/career_services.yaml')
  const raw = fs.readFileSync(fs.existsSync(seedPath) ? seedPath : fallbackPath, 'utf8')
  const parsed = yaml.load(raw)
  return yaml.dump(parsed)
}

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

      const session = await interviewApi.create(sme_id)
      const sme = await smeApi.getById(sme_id)
      const seedQuestions = loadSeedQuestions(sme?.domain || 'career_services')

      // Get first question from Claude
      const firstMessage = await conductInterview([], `We are capturing knowledge about "${topic}".`, seedQuestions)

      const messages: InterviewMessage[] = [{
        role: 'assistant',
        content: firstMessage,
        timestamp: new Date().toISOString()
      }]

      // Store topic in draft_profile; move to active stage
      await interviewApi.update(session.session_id, {
        draft_profile: { topic, seed_questions: seedQuestions },
        stage: 'interview_active',
        message_history: messages
      })

      return NextResponse.json({
        interview_id: session.session_id,
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

      const session = await interviewApi.getById(interview_id)
      if (!session) {
        return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
      }

      const updatedMessages: InterviewMessage[] = [
        ...(session.message_history || []),
        {
          role: 'sme',
          content: message,
          timestamp: new Date().toISOString()
        }
      ]

      const seedQuestions = (session.draft_profile as any)?.seed_questions || loadSeedQuestions()
      const assistantResponse = await conductInterview(updatedMessages, '', seedQuestions)

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
        message_history: finalMessages,
        stage: isComplete ? 'synthesis_review' : 'interview_active'
      })

      return NextResponse.json({
        message: assistantResponse,
        status: isComplete ? 'completed' : 'in_progress',
        interview_id
      })
    }

    // --- Synthesize and create KB drafts ---
    if (action === 'synthesize') {
      if (!interview_id || !sme_id) {
        return NextResponse.json(
          { error: 'interview_id and sme_id required' },
          { status: 400 }
        )
      }

      const session = await interviewApi.getById(interview_id)
      if (!session) {
        return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
      }

      const topic: string = session.draft_profile?.topic || 'General Knowledge'
      const messageHistory: InterviewMessage[] = session.message_history || []

      // Save raw transcript (never exposed to end users)
      const transcript = await transcriptApi.create(sme_id, interview_id, messageHistory)

      // Synthesize — returns array of 4-6 entries
      const synthesized = await synthesizeKBEntries(messageHistory, topic)

      // Create each KB entry as a draft
      // LLM returns topic_tag as string; schema v0.2 stores TEXT[] (primary at [0])
      const createdEntries = await Promise.all(
        synthesized.map(entry =>
          kbApi.create({
            sme_id,
            topic_tag: Array.isArray(entry.topic_tag) ? entry.topic_tag : [entry.topic_tag],
            question_framing: entry.question_framing,
            synthesized_answer: entry.synthesized_answer,
            exposable_to_users: entry.exposable_to_users,
            raw_transcript_id: transcript.transcript_id,
            status: 'draft'
          })
        )
      )

      // Update session: mark completed, store entry refs
      await interviewApi.update(interview_id, {
        stage: 'completed',
        draft_entries: createdEntries.map(e => ({
          entry_id: e.entry_id,
          topic_tag: e.topic_tag
        }))
      })

      return NextResponse.json({
        kb_entries: createdEntries,
        count: createdEntries.length,
        message: 'Knowledge entries synthesized. Please review and approve each entry.'
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
