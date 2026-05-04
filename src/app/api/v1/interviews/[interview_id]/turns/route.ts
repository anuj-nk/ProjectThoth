import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { interviewApi, interviewV1Api } from '@/lib/supabase'
import { callLLM, SME_INTERVIEW_SYSTEM_PROMPT } from '@/lib/claude'

export async function POST(req: NextRequest, { params }: { params: Promise<{ interview_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { interview_id } = await params
    const session = await interviewApi.getById(interview_id)
    if (!session) return NextResponse.json({ error: 'Interview not found', code: 'NOT_FOUND' }, { status: 404 })

    const body = await req.json()
    if (!body.sme_response) return NextResponse.json({ error: 'Missing required field: sme_response', code: 'MISSING_FIELDS' }, { status: 400 })

    const history: any[] = session.message_history || []
    const turnNumber = Math.floor(history.filter((m: any) => m.role === 'user').length) + 1

    // Build message history for LLM
    const llmMessages = history.map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }))
    llmMessages.push({ role: 'user', content: body.sme_response })

    // Generate next question
    const llmResult = await callLLM(SME_INTERVIEW_SYSTEM_PROMPT, llmMessages, 400)
    const isComplete = turnNumber >= 15 || llmResult.text.includes("I think I have a solid understanding")

    const ts = new Date().toISOString()
    await interviewV1Api.appendTurn(interview_id, body.sme_response, llmResult.text)

    if (isComplete) {
      await interviewV1Api.complete(interview_id)
    }

    return NextResponse.json({
      turn_number: turnNumber,
      sme_response: body.sme_response,
      agent_follow_up: isComplete ? null : llmResult.text,
      timestamp: ts,
      usage: llmResult.usage,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
