import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { smeApi, kbApi, interviewApi, materialsApi, supabaseAdmin } from '@/lib/supabase'
import { callLLM, SYNTHESIS_SYSTEM_PROMPT } from '@/lib/claude'
import { dbEntryToSpec } from '@/lib/v1-mappers'

export async function POST(req: NextRequest, { params }: { params: Promise<{ sme_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { sme_id } = await params
    const sme = await smeApi.getById(sme_id)
    if (!sme) return NextResponse.json({ error: 'SME not found', code: 'NOT_FOUND' }, { status: 404 })

    const body = await req.json()
    const { interview_ids, material_ids, topic } = body
    if (!topic) return NextResponse.json({ error: 'Missing required field: topic', code: 'MISSING_FIELDS' }, { status: 400 })

    // Load interview transcripts
    const interviewTexts: string[] = []
    for (const id of (interview_ids || [])) {
      const session = await interviewApi.getById(id)
      if (session?.message_history) {
        const turns = (session.message_history as any[]).map((m: any) =>
          `${m.role === 'assistant' ? 'Thoth' : 'SME'}: ${m.content}`
        ).join('\n')
        interviewTexts.push(turns)
      }
    }

    // Load material content (text extraction for PDFs is basic for PoC)
    const materialTexts: string[] = []
    for (const mid of (material_ids || [])) {
      const mat = await materialsApi.getById(mid)
      if (mat) {
        try {
          const { data } = await supabaseAdmin.storage.from('sme-docs').download(mat.storage_path)
          if (data) {
            const text = await data.text()
            materialTexts.push(`[Material: ${mat.title}]\n${text.slice(0, 2000)}`)
          }
        } catch { /* skip unreadable materials */ }
      }
    }

    const combinedText = [
      interviewTexts.length ? `INTERVIEW TRANSCRIPTS:\n${interviewTexts.join('\n\n---\n\n')}` : '',
      materialTexts.length ? `SUPPORTING MATERIALS:\n${materialTexts.join('\n\n---\n\n')}` : '',
    ].filter(Boolean).join('\n\n')

    if (!combinedText.trim()) {
      return NextResponse.json({ error: 'No content found from the provided interview_ids or material_ids', code: 'NO_CONTENT' }, { status: 400 })
    }

    const llmResult = await callLLM(
      SYNTHESIS_SYSTEM_PROMPT,
      [{ role: 'user', content: `Synthesize this content about "${topic}" into knowledge base entries:\n\n${combinedText}` }],
      1500
    )

    let entries: any[] = []
    try {
      const cleaned = llmResult.text.replace(/^```json\s*/im, '').replace(/\s*```$/im, '').trim()
      const start = cleaned.search(/[[{]/)
      const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
      entries = JSON.parse(cleaned.slice(start, end + 1))
      if (!Array.isArray(entries)) entries = [entries]
    } catch {
      entries = [{ topic_tag: topic.toLowerCase().replace(/\s+/g, '_'), question_framing: `What should I know about ${topic}?`, synthesized_answer: combinedText.slice(0, 300), exposable_to_users: true }]
    }

    // Spec returns ONE entry. Pick the one whose topic_tag best matches the requested topic.
    // Our internal synthesis produces 4-6 entries; we pick the best match and save all, returning the best.
    const topicLower = topic.toLowerCase().replace(/\s+/g, '_')
    const best = entries.find((e: any) => (e.topic_tag || '').includes(topicLower.split('_')[0])) || entries[0]

    // Store source IDs as a structured object in supporting_doc_ids so GET /knowledge/{id}
    // can reconstruct sources correctly (spec requires interviews[] and materials[]).
    const sourceDocs = { interviews: interview_ids || [], materials: material_ids || [] }

    // Insert all entries (saves knowledge), but return the best match
    const insertedIds: string[] = []
    for (const e of entries) {
      const row = await kbApi.create({
        sme_id,
        topic_tag: e.topic_tag,
        question_framing: e.question_framing,
        synthesized_answer: e.synthesized_answer,
        exposable_to_users: e.exposable_to_users ?? true,
        status: 'draft',
        supporting_doc_ids: sourceDocs,
      })
      insertedIds.push(row.entry_id)
    }

    // Fetch the inserted row that matches `best`
    const bestIndex = entries.indexOf(best)
    const bestRow = await kbApi.getById(insertedIds[bestIndex] || insertedIds[0])

    return NextResponse.json({
      ...dbEntryToSpec(bestRow),
      usage: llmResult.usage,
    }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
