import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { interviewApi } from '@/lib/supabase'
import { dbInterviewToSpec } from '@/lib/v1-mappers'

export async function GET(req: NextRequest, { params }: { params: Promise<{ interview_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { interview_id } = await params
    const session = await interviewApi.getById(interview_id)
    if (!session) return NextResponse.json({ error: 'Interview not found', code: 'NOT_FOUND' }, { status: 404 })

    const messages: any[] = session.message_history || []
    // Build turns array: pair up user+assistant messages
    const turns: any[] = []
    let turnNum = 0
    for (let i = 0; i < messages.length; i += 2) {
      const userMsg = messages[i]
      const assistantMsg = messages[i + 1]
      if (userMsg?.role === 'user') {
        turnNum++
        turns.push({
          turn_number: turnNum,
          sme_response: userMsg.content,
          agent_follow_up: assistantMsg?.content ?? null,
          timestamp: userMsg.timestamp ?? assistantMsg?.timestamp ?? new Date().toISOString(),
        })
      }
    }

    return NextResponse.json({
      ...dbInterviewToSpec(session),
      turns,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
