import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { smeApi, interviewApi, interviewV1Api } from '@/lib/supabase'
import { dbInterviewToSpec } from '@/lib/v1-mappers'
import { generateInterviewPlan } from '@/lib/claude'
import { loadSeedQuestionLibrary } from '@/lib/interview-seeds'

export async function POST(req: NextRequest, { params }: { params: Promise<{ sme_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { sme_id } = await params
    const sme = await smeApi.getById(sme_id)
    if (!sme) return NextResponse.json({ error: 'SME not found', code: 'NOT_FOUND' }, { status: 404 })

    const body = await req.json()
    if (!body.topic) return NextResponse.json({ error: 'Missing required field: topic', code: 'MISSING_FIELDS' }, { status: 400 })

    const seedLibrary = loadSeedQuestionLibrary(sme.domain || 'general_sme')
    const interviewPlan = await generateInterviewPlan(sme, body.topic, seedLibrary.content)
    const row = await interviewV1Api.create(sme_id, body.topic)
    const updatedRow = await interviewApi.update(row.session_id, {
      draft_profile: {
        topic: body.topic,
        seed_questions: seedLibrary.content,
        seed_source: seedLibrary.source,
        generated_interview_plan: interviewPlan,
      },
    })
    return NextResponse.json(dbInterviewToSpec(updatedRow), { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ sme_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { sme_id } = await params
    const rows = await interviewApi.getBySME(sme_id)
    return NextResponse.json({ interviews: rows.map(dbInterviewToSpec) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
