import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { requireBenchmarkAuth } from '@/lib/auth'
import { smeApi, interviewApi, interviewV1Api } from '@/lib/supabase'
import { callLLM, SME_INTERVIEW_SYSTEM_PROMPT } from '@/lib/claude'

// P6: load the per-domain seed question library so interview turns are
// guided by the curated YAML instead of the LLM guessing what to ask next.
// Mirrors the loader already used by the non-v1 /api/sme/interview route.
function loadSeedQuestions(domain: string = 'career_services'): string {
  const fileName = `${domain}.yaml`
  const seedPath = path.join(process.cwd(), 'src/data/seed_questions', fileName)
  const fallbackPath = path.join(process.cwd(), 'src/data/seed_questions/career_services.yaml')
  const target = fs.existsSync(seedPath) ? seedPath : fallbackPath
  try {
    const raw = fs.readFileSync(target, 'utf8')
    return yaml.dump(yaml.load(raw))
  } catch {
    return ''
  }
}

// P6: build a focused system prompt that pins the interview to a specific
// topic AND injects the seed question library. Without this the v1 turns
// endpoint produced unfocused, random-feeling questions because the LLM
// had no topic anchor and no curated question pool to draw from.
function buildFocusedInterviewPrompt(topic: string, seedQuestions: string): string {
  const topicBlock = topic
    ? `\nTHIS INTERVIEW IS SCOPED TO TOPIC: "${topic}"
- Do NOT ask the SME to pick a topic; they already chose "${topic}".
- Stay on this topic. If the SME drifts, gently bring them back.
- Skip Phase 1 (topic selection). Open with a Phase 2 question focused on "${topic}".\n`
    : ''

  const seedBlock = seedQuestions?.trim()
    ? `\nDOMAIN SEED QUESTION LIBRARY (use as your interview guide):
Pick the best next question from this library based on the SME's prior answer.
Do not ask every question. Ask ONE question at a time. Adapt wording to context.

${seedQuestions}\n`
    : ''

  return `${SME_INTERVIEW_SYSTEM_PROMPT}${topicBlock}${seedBlock}`
}

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

    // P6: load SME's domain so we hit the right seed file (falls back to career_services)
    const sme = await smeApi.getById((session as any).sme_id)
    const topic = String((session as any).topic || '')
    const seedQuestions = loadSeedQuestions(sme?.domain || 'career_services')
    const systemPrompt = buildFocusedInterviewPrompt(topic, seedQuestions)

    // Build message history for LLM
    const llmMessages = history.map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }))
    llmMessages.push({ role: 'user', content: body.sme_response })

    // Generate next question with the focused (topic + seed library) prompt
    const llmResult = await callLLM(systemPrompt, llmMessages, 400)
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
