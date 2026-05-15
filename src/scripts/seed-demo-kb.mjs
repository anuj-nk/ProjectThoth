import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const hfKey = process.env.HUGGINGFACE_API_KEY

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, serviceKey)
const root = process.cwd()
const kbEntries = JSON.parse(fs.readFileSync(path.join(root, 'src/scripts/last-kb-entries.json'), 'utf8'))
const transcriptData = JSON.parse(fs.readFileSync(path.join(root, 'src/scripts/last-transcript.json'), 'utf8'))

const demoSme = {
  full_name: 'Patrick Chidsey',
  email: 'patrick.demo@gix.uw.edu',
  title: 'Assistant Director, Career Services & Industry Engagement',
  domain: 'career_services',
  topics: ['cpt', 'internship', 'techin_601', 'internship_search', 'career_coaching'],
  exclusions: ['fee_waiver', 'course_petitions', 'transcripts'],
  routing_preferences: [{ channel: 'email', priority: 1 }],
  availability: 'Demo SME for Project Thoth career services flow',
}

function padEmbedding(embedding, dimensions = 1536) {
  if (embedding.length === dimensions) return embedding
  if (embedding.length > dimensions) return embedding.slice(0, dimensions)
  return [...embedding, ...Array(dimensions - embedding.length).fill(0)]
}

async function generateDemoEmbedding(text) {
  if (!hfKey) throw new Error('Missing HUGGINGFACE_API_KEY')

  const response = await fetch(
    'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    }
  )

  if (!response.ok) throw new Error(`HuggingFace embedding failed: HTTP ${response.status}`)

  const data = await response.json()
  if (Array.isArray(data) && Array.isArray(data[0])) return padEmbedding(data[0])
  if (Array.isArray(data) && typeof data[0] === 'number') return padEmbedding(data)
  if (data.embeddings) return padEmbedding(data.embeddings[0])
  throw new Error('Unexpected HuggingFace embedding response')
}

async function main() {
  const { data: sme, error: smeError } = await supabase
    .from('sme_profiles')
    .upsert(demoSme, { onConflict: 'email' })
    .select()
    .single()
  if (smeError) throw smeError

  const { data: session, error: sessionError } = await supabase
    .from('interview_sessions')
    .insert({
      sme_id: sme.sme_id,
      stage: 'completed',
      message_history: transcriptData.transcript,
      draft_profile: { topic: 'career_services' },
      draft_entries: [],
    })
    .select()
    .single()
  if (sessionError) throw sessionError

  const { data: transcript, error: transcriptError } = await supabase
    .from('raw_transcripts')
    .insert({
      sme_id: sme.sme_id,
      session_id: session.session_id,
      messages: transcriptData.transcript,
      uploaded_doc_ids: [],
      synthesized_entry_ids: [],
    })
    .select()
    .single()
  if (transcriptError) throw transcriptError

  const createdIds = []

  for (const entry of kbEntries) {
    const textToEmbed = `${entry.question_framing}\n\n${entry.synthesized_answer}`
    const embedding = await generateDemoEmbedding(textToEmbed)

    const { data: created, error } = await supabase
      .from('knowledge_entries')
      .insert({
        sme_id: sme.sme_id,
        topic_tag: [entry.topic_tag],
        question_framing: entry.question_framing,
        synthesized_answer: entry.synthesized_answer,
        supporting_doc_ids: [],
        exposable_to_users: entry.exposable_to_users,
        raw_transcript_id: transcript.transcript_id,
        embedding,
        status: 'approved',
        approved_by_sme_id: sme.sme_id,
        approved_at: new Date().toISOString(),
        next_review_due: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    createdIds.push(created.entry_id)
  }

  await supabase
    .from('raw_transcripts')
    .update({ synthesized_entry_ids: createdIds })
    .eq('transcript_id', transcript.transcript_id)

  console.log(`Seeded ${createdIds.length} approved KB entries for ${sme.full_name}.`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
