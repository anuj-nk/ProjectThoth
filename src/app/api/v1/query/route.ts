import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { querySessionsApi, kbV1Api, smeApi } from '@/lib/supabase'
import { callLLM, generateEmbedding } from '@/lib/claude'

const DISCLAIMER = 'This information is based on approved expert knowledge and does not constitute professional advice.'
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD ?? '0.75')

export async function POST(req: NextRequest) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const body = await req.json()
    if (!body.question) return NextResponse.json({ error: 'Missing required field: question', code: 'MISSING_FIELDS' }, { status: 400 })
    if (!body.session_id) return NextResponse.json({ error: 'Missing required field: session_id', code: 'MISSING_FIELDS' }, { status: 400 })

    const { question, session_id } = body
    const ts = new Date().toISOString()

    // 1. Get/create session
    const session = await querySessionsApi.getOrCreate(session_id)
    const context = session.context || []

    // 2. Generate embedding
    const embedding = await generateEmbedding(question)

    // 3. Vector search
    const kbResults = await kbV1Api.semanticSearch(embedding, 0.3, 5)
    const topScore = kbResults[0]?.similarity ?? 0

    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, model: '' }

    const addUsage = (u: any) => {
      if (!u) return
      totalUsage.prompt_tokens += u.prompt_tokens || 0
      totalUsage.completion_tokens += u.completion_tokens || 0
      totalUsage.total_tokens += u.total_tokens || 0
      totalUsage.model = u.model || totalUsage.model
    }

    let responsePayload: any

    if (topScore >= CONFIDENCE_THRESHOLD && kbResults.some((e: any) => e.exposable_to_users)) {
      // 4a. Grounded answer
      const exposable = kbResults.filter((e: any) => e.exposable_to_users)
      const kbText = exposable.map((e: any, i: number) =>
        `[${i+1}] topic: "${e.topic_tag}" (${((e.similarity||0)*100).toFixed(0)}% match)\nQ: ${e.question_framing}\nA: ${e.synthesized_answer}`
      ).join('\n\n')

      const systemPrompt = `You are Thoth, a knowledge assistant. Answer the user's question using ONLY the knowledge base entries below. Be concise and accurate. Do not fabricate.\n\nKNOWLEDGE BASE:\n${kbText}`
      const llmResult = await callLLM(systemPrompt, [{ role: 'user', content: question }], 600)
      addUsage(llmResult.usage)

      // Build sources from matching entries
      const sources = exposable.slice(0, 3).map((e: any) => ({
        entry_id: e.entry_id,
        sme_name: e.sme_profiles?.full_name ?? 'Unknown SME',
        topic: Array.isArray(e.topic_tag) ? e.topic_tag[0] : e.topic_tag,
      }))

      responsePayload = {
        answer: llmResult.text,
        grounded: true,
        sources,
        disclaimer: DISCLAIMER,
        session_id,
        response_type: 'answer',
        routed_to: null,
        timestamp: ts,
        usage: totalUsage,
      }
    } else {
      // 4b. Routing or clarification
      const allSMEs = await smeApi.getAll()
      const smeList = allSMEs.map((s: any) =>
        `- ${s.full_name} (${s.domain}): topics=[${(s.topics||[]).join(', ')}] email=${s.email}`
      ).join('\n')

      const recentContext = context.slice(-3).map((c: any) => `Q: ${c.question}\nA: ${c.answer}`).join('\n')

      const routingPrompt = `You are Thoth. You could not find a high-confidence answer in the knowledge base.

QUESTION: ${question}
${recentContext ? `RECENT CONTEXT:\n${recentContext}` : ''}
AVAILABLE SMEs:
${smeList || 'None registered'}

Decide: is the question too vague (return clarification), or should we route to an SME or admin?

Return ONLY valid JSON:
{
  "decision": "clarification" | "routing",
  "clarifying_question": "string if clarification",
  "routed_to": [{"type": "sme" | "admin", "sme_name": string | null, "sme_email": string | null, "specialization": string, "reason": string}]
}`

      const llmResult = await callLLM(routingPrompt, [{ role: 'user', content: question }], 500)
      addUsage(llmResult.usage)

      let parsed: any = { decision: 'routing', routed_to: [{ type: 'admin', sme_name: null, specialization: 'General', reason: 'No matching SME found' }] }
      try {
        const cleaned = llmResult.text.replace(/^```json\s*/im, '').replace(/\s*```$/im, '').trim()
        const s = cleaned.search(/[[{]/)
        const e = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
        parsed = JSON.parse(cleaned.slice(s, e + 1))
      } catch { /* use fallback */ }

      if (parsed.decision === 'clarification') {
        responsePayload = {
          answer: parsed.clarifying_question || 'Could you clarify your question?',
          grounded: false,
          sources: [],
          disclaimer: null,
          session_id,
          response_type: 'clarification',
          routed_to: null,
          timestamp: ts,
          usage: totalUsage,
        }
      } else {
        const routedTo = (parsed.routed_to || []).map((r: any) => ({
          type: r.type || 'admin',
          sme_name: r.sme_name || null,
          specialization: r.specialization || 'General',
          reason: r.reason || 'No knowledge base match',
        }))

        const answer = routedTo.length === 1 && routedTo[0].sme_name
          ? `I don't have a complete answer in the knowledge base. I'm connecting you with ${routedTo[0].sme_name}, who owns this area.`
          : routedTo.length > 1
          ? `This question spans multiple areas. I recommend consulting: ${routedTo.map((r: any) => r.sme_name || 'Admin').join(', ')}.`
          : "This question falls outside our current knowledge base. I've logged it for the admin team."

        responsePayload = {
          answer,
          grounded: false,
          sources: [],
          disclaimer: null,
          session_id,
          response_type: 'routing',
          routed_to: routedTo,
          timestamp: ts,
          usage: totalUsage,
        }
      }
    }

    // 5. Update session context
    await querySessionsApi.appendTurn(session_id, { question, answer: responsePayload.answer, timestamp: ts })

    return NextResponse.json(responsePayload)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
