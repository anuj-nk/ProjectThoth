// ============================================
// PROJECT THOTH - LLM Client
// Provider order: OpenRouter free → Groq fallback
// ============================================

import { buildAdaptiveInterviewPrompt } from '@/lib/interview-seeds'

export type LlmUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  model: string
}

export type LlmResponse = {
  text: string
  usage: LlmUsage
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

// OpenRouter free models — tried in order
const FREE_MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'microsoft/phi-4:free',
  'qwen/qwen3-8b:free',
  'google/gemma-3-12b-it:free',
  'openai/gpt-oss-20b:free',
]

// Groq models — fast reliable fallback
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
]

// Set for demo day: 'anthropic/claude-sonnet-4-5' or 'google/gemini-flash-1.5'
// null = use free fallbacks
const PRODUCTION_MODEL: string | null = null

// ============================================
// TYPES (matching actual DB schema)
// ============================================
export interface SMERow {
  sme_id: string
  full_name: string
  email: string
  title?: string
  domain: string
  topics: string[]
  exclusions: string[]
  routing_preferences: any[]
  availability?: string
}

export interface KBRow {
  entry_id: string
  sme_id: string
  topic_tag: string | string[]
  question_framing: string
  synthesized_answer: string
  exposable_to_users: boolean
  status: string
  similarity?: number
}

export interface QueryResult {
  action: 'answered' | 'clarified' | 'routed_sme' | 'routed_admin'
  answer?: string
  clarifying_question?: string
  routed_sme?: SMERow
  routed_smes?: SMERow[]
  routing_reason?: string
  kb_entries_used: string[]
  confidence_score: number
  sources?: { topic_tag: string; exposable_to_users: boolean }[]
}

export interface InterviewMessage {
  role: 'sme' | 'assistant'
  content: string
  timestamp?: string
}

// ============================================
// LOW-LEVEL CALLERS
// ============================================
async function callOpenRouterModel(
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number
): Promise<{ text: string; usage: LlmUsage }> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Project Thoth'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    })
  })

  if (response.status === 429) throw new Error('rate limited')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const data = await response.json()
  if (data.error) throw new Error(data.error.message)

  const content = data.choices?.[0]?.message?.content || ''
  if (!content) throw new Error('empty response')

  const usage: LlmUsage = {
    prompt_tokens: data.usage?.prompt_tokens ?? 0,
    completion_tokens: data.usage?.completion_tokens ?? 0,
    total_tokens: data.usage?.total_tokens ?? 0,
    model,
  }
  return { text: content, usage }
}

async function callGroqModel(
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number
): Promise<{ text: string; usage: LlmUsage }> {
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    })
  })

  if (response.status === 429) throw new Error('rate limited')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const data = await response.json()
  if (data.error) throw new Error(data.error.message)

  const content = data.choices?.[0]?.message?.content || ''
  if (!content) throw new Error('empty response')

  const usage: LlmUsage = {
    prompt_tokens: data.usage?.prompt_tokens ?? 0,
    completion_tokens: data.usage?.completion_tokens ?? 0,
    total_tokens: data.usage?.total_tokens ?? 0,
    model,
  }
  return { text: content, usage }
}

// ============================================
// CORE CALLER: OpenRouter → Groq fallback
// ============================================
export async function callLLM(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number = 800,
  preferredModel?: string
): Promise<LlmResponse> {
  if (PRODUCTION_MODEL) {
    return callOpenRouterModel(PRODUCTION_MODEL, systemPrompt, messages, maxTokens)
  }

  const errors: string[] = []
  const openRouterModels = preferredModel
    ? [preferredModel, ...FREE_MODELS.filter(m => m !== preferredModel)]
    : FREE_MODELS

  // Try OpenRouter free models
  for (const model of openRouterModels) {
    try {
      console.log(`[Thoth] Trying OpenRouter: ${model}`)
      const result = await callOpenRouterModel(model, systemPrompt, messages, maxTokens)
      console.log(`[Thoth] Success: ${model}`)
      return result
    } catch (err: any) {
      errors.push(`OpenRouter/${model}: ${err.message}`)
      continue
    }
  }

  // Fall back to Groq
  if (GROQ_API_KEY) {
    console.log('[Thoth] All OpenRouter models failed — falling back to Groq...')
    for (const model of GROQ_MODELS) {
      try {
        console.log(`[Thoth] Trying Groq: ${model}`)
        const result = await callGroqModel(model, systemPrompt, messages, maxTokens)
        console.log(`[Thoth] Success (Groq): ${model}`)
        return result
      } catch (err: any) {
        errors.push(`Groq/${model}: ${err.message}`)
        continue
      }
    }
  }

  throw new Error(`All models failed:\n${errors.join('\n')}`)
}

// Backwards-compatible shim: returns just the text string
async function askLLMText(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens?: number,
  preferredModel?: string
): Promise<string> {
  return (await callLLM(systemPrompt, messages, maxTokens, preferredModel)).text
}

// ============================================
// HELPER: Parse JSON safely from LLM output
// ============================================
function parseJSON<T>(text: string, fallback: T): T {
  try {
    const cleaned = text
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/\s*```$/im, '')
      .trim()

    const start = cleaned.search(/[[{]/)
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))

    if (start === -1 || end === -1) return fallback
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return fallback
  }
}

// ============================================
// PROMPT: SME PROFILE EXTRACTOR (A2)
// ============================================
export const PROFILE_EXTRACTION_SYSTEM_PROMPT = `You are a profile extraction assistant for Project Thoth.

Given raw input text (URL, email signature, job description, or free text), extract a structured SME profile.

Return ONLY valid JSON. No markdown, no prose, no code blocks.

Required format:
{
  "full_name": "string",
  "email": "string or null",
  "title": "string or null",
  "domain": "one of: academics | career_services | facilities | prototyping_lab | admissions | it_purchasing | student_wellbeing | other",
  "topics": ["array of specific topics this person owns"],
  "exclusions": ["array of topics this person does NOT own"],
  "routing_preferences": [{"channel": "teams|email|scheduling_link|in_person", "priority": 1}],
  "availability": "free text availability notes or null",
  "confidence_notes": {
    "full_name": "high|medium|low",
    "domain": "high|medium|low",
    "topics": "high|medium|low",
    "exclusions": "high|medium|low"
  }
}

Rules:
- Use exact domain values listed above
- If a field is uncertain, mark it low confidence — do NOT fabricate
- topics should be specific (e.g. "equipment access process" not just "operations")
- exclusions are topics this person explicitly does NOT own`

function buildProfileExtractionPrompt(domainValues?: string[]): string {
  if (!domainValues?.length) return PROFILE_EXTRACTION_SYSTEM_PROMPT

  const domains = domainValues.join(' | ')
  return PROFILE_EXTRACTION_SYSTEM_PROMPT
    .replace(
      '"domain": "one of: academics | career_services | facilities | prototyping_lab | admissions | it_purchasing | student_wellbeing | other"',
      `"domain": "one of: ${domains}"`
    )
    .replace(
      '- Use exact domain values listed above',
      `- Use exact domain values listed above: ${domains}`
    )
}

// ============================================
// PROMPT: SME INTERVIEW CONDUCTOR (B2)
// ============================================
export const SME_INTERVIEW_SYSTEM_PROMPT = `You are Thoth, a knowledge capture assistant for an organizational knowledge base.

Interview a Subject Matter Expert to capture their knowledge. Ask ONE question at a time. Be conversational, warm, and concise.

PHASE 1 - OPENING (1-2 turns):
Ask what topic they want to capture today, and confirm what it covers and does NOT cover.

PHASE 2 - CORE KNOWLEDGE (4-6 turns):
- What are the 3-5 most important things people should know?
- What do people most commonly misunderstand or get wrong?
- What questions do you get asked most often?
- What tacit knowledge exists that is not written down anywhere?

PHASE 3 - BOUNDARY PROBES (1-2 turns):
- What is explicitly outside your scope?
- Who should people go to for related topics you do not cover?

PHASE 4 - EVIDENCE PROBES (1-2 turns):
- Are there any documents, checklists, or resources that support this?
- What would you point someone to first?

PHASE 5 - EXPOSURE POLICY (1 turn):
- Is there anything from this conversation that should NOT be shown directly to end users?

PHASE 6 - WRAP UP (1 turn):
- Is there anything important I have not asked about?

When all phases are complete, say EXACTLY:
"I think I have a solid understanding. Let me prepare a summary for your review."

Start by greeting the SME and asking what topic they want to capture today.`

function buildInterviewSystemPrompt(seedQuestions?: string): string {
  if (!seedQuestions?.trim()) return SME_INTERVIEW_SYSTEM_PROMPT

  return `${SME_INTERVIEW_SYSTEM_PROMPT}

DOMAIN SEED QUESTION LIBRARY:
Use these runtime-loaded seed questions as your interview guide. Do not ask every question. Pick the best next question based on the SME's prior answer, and ask one question at a time.

${seedQuestions}`
}

function fallbackInterviewPlan(topic: string, smeProfile?: Partial<SMERow>): string[] {
  const label = topic || smeProfile?.topics?.[0] || 'the SME selected topic'
  return [
    `Clarify what "${label}" covers and what outcome people usually want.`,
    `Walk through the normal process for "${label}" from first request to resolution.`,
    `Identify the most common mistakes, misconceptions, or missing steps.`,
    `Capture tacit judgment: edge cases, triage rules, and when expert review is needed.`,
    `Map boundaries: what is outside this SME's ownership and who owns adjacent topics.`,
    `Ask for supporting documents, templates, policies, examples, or links.`,
    `Decide which answers are safe to expose directly and which should route to an expert.`,
    `Set a review cadence and identify predictable moments when this knowledge changes.`,
  ]
}

export async function generateInterviewPlan(
  smeProfile: Partial<SMERow> | null,
  topic: string,
  seedQuestions: string
): Promise<string[]> {
  const fallback = fallbackInterviewPlan(topic, smeProfile || undefined)

  try {
    const systemPrompt = `You generate concise interview plans for Project Thoth SME onboarding.

Return ONLY valid JSON. No markdown, no prose.

Required format:
{
  "questions": [
    "question 1",
    "question 2"
  ]
}

Rules:
- Generate 8-12 questions.
- Adapt the general seed playbook to the SME's role, domain, topics, exclusions, and selected interview topic.
- Questions must be specific enough to feel written for this SME.
- Cover scope, process, tacit knowledge, boundaries, evidence, exposure policy, and maintenance.
- Do not assume the SME owns a topic listed in exclusions.
- Do not mention internal implementation details like taxonomy, YAML, embeddings, or JSON.`

    const text = await askLLMText(
      systemPrompt,
      [{
        role: 'user',
        content: JSON.stringify({
          selected_topic: topic,
          sme_profile: smeProfile,
          general_seed_question_playbook: seedQuestions,
        }, null, 2),
      }],
      1200
    )

    const parsed = parseJSON<{ questions?: unknown }>(text, { questions: fallback })
    if (!Array.isArray(parsed.questions)) return fallback

    const questions = parsed.questions
      .filter((question): question is string => typeof question === 'string' && question.trim().length > 0)
      .map(question => question.trim())

    return questions.length > 0 ? questions.slice(0, 12) : fallback
  } catch {
    return fallback
  }
}

// ============================================
// PROMPT: KB ENTRY SYNTHESIZER (D1)
// ============================================
export const SYNTHESIS_SYSTEM_PROMPT = `You are a knowledge synthesis assistant for Project Thoth.

Given an interview transcript, synthesize the content into 4-6 structured knowledge base entries.

Return ONLY a valid JSON array. No markdown, no prose, no code blocks.

Required format:
[
  {
    "topic_tag": "snake_case_topic_label",
    "question_framing": "The question this entry answers, written as a natural user question",
    "synthesized_answer": "The answer in 2-4 clear sentences. Use the SME voice but rewrite for clarity.",
    "exposable_to_users": true
  }
]

Rules:
- topic_tag must be snake_case (e.g. "equipment_access", "policy_exception_process")
- question_framing should sound like a real user question
- synthesized_answer must be 2-4 sentences — no padding, no filler
- exposable_to_users: false if the SME flagged this topic as sensitive or internal-only
- Do NOT fabricate anything not in the transcript
- Cluster related points — avoid redundant entries
- Do NOT include the SME's personal name in synthesized_answer`

// ============================================
// PROMPT: USER QUERY HANDLER (F6)
// ============================================
const buildQueryPrompt = (kbResults: KBRow[], allSMEs: SMERow[]) =>
  `You are Thoth, a knowledge assistant. Answer questions using ONLY the knowledge base entries below.

ROUTING RULES:
- KB entry found with good match (similarity > 0.7) AND exposable_to_users=true -> action: "answered"
- Question is too vague to match -> action: "clarified", ask ONE follow-up question
- No KB match but an SME owns this topic -> action: "routed_sme"
- Completely outside known coverage -> action: "routed_admin"

KNOWLEDGE BASE:
${kbResults.length > 0
    ? kbResults.map((e, i) =>
      `[${i + 1}] topic: "${Array.isArray(e.topic_tag) ? e.topic_tag.join(', ') : e.topic_tag}" (match: ${((e.similarity || 0) * 100).toFixed(0)}%)
Q: ${e.question_framing}
A: ${e.synthesized_answer}
exposable: ${e.exposable_to_users}`
    ).join('\n\n---\n\n')
    : 'EMPTY - no relevant entries found.'}

AVAILABLE SMEs:
${allSMEs.length > 0
    ? allSMEs.map(s =>
      `- ${s.full_name} (${s.title || s.domain}): topics=[${(s.topics || []).join(', ')}] email=${s.email}`
    ).join('\n')
    : 'No SMEs registered yet.'}

Return ONLY valid JSON, no markdown:
{
  "action": "answered|clarified|routed_sme|routed_admin",
  "answer": "Full answer if action=answered",
  "clarifying_question": "Your question if action=clarified",
  "routed_sme_email": "email if routing to one SME",
  "routed_sme_emails": ["email1", "email2"],
  "routing_reason": "Why you are routing",
  "confidence_score": 0.85,
  "sources_used": ["topic_tag1"],
  "kb_entry_ids": ["uuid1"]
}`

// ============================================
// EXPORTED FUNCTIONS
// ============================================

export async function extractProfile(rawInput: string, domainValues?: string[]): Promise<any> {
  const text = await askLLMText(
    buildProfileExtractionPrompt(domainValues),
    [{ role: 'user', content: rawInput }],
    800
  )
  const fallback = {
    full_name: null, email: null, title: null, domain: 'other',
    topics: [], exclusions: [], routing_preferences: [],
    availability: null, confidence_notes: {}
  }
  return parseJSON(text, fallback)
}

export async function conductInterview(
  messages: InterviewMessage[],
  smeInput: string,
  seedQuestions?: string,
  options?: {
    smeProfile?: Partial<SMERow> | null
    interviewPlan?: string[]
    topic?: string
  }
): Promise<string> {
  const history = messages.map(m => ({
    role: m.role === 'sme' ? 'user' as const : 'assistant' as const,
    content: m.content
  }))
  const fullMessages = history.length > 0
    ? history
    : [{ role: 'user' as const, content: smeInput || 'Hello, ready to start.' }]
  const adaptivePrompt = buildAdaptiveInterviewPrompt({
    topic: options?.topic,
    seedQuestions,
    smeProfile: options?.smeProfile,
    interviewPlan: options?.interviewPlan,
  })
  return askLLMText(`${buildInterviewSystemPrompt(seedQuestions)}\n\n${adaptivePrompt}`, fullMessages, 400)
}

export async function synthesizeKBEntries(
  transcript: InterviewMessage[],
  topic: string
): Promise<Array<{
  topic_tag: string
  question_framing: string
  synthesized_answer: string
  exposable_to_users: boolean
}>> {
  const transcriptText = transcript
    .map(m => `${m.role === 'assistant' ? 'Thoth' : 'SME'}: ${m.content}`)
    .join('\n\n')

  const text = await askLLMText(
    SYNTHESIS_SYSTEM_PROMPT,
    [{ role: 'user', content: `Synthesize this interview about "${topic}" into knowledge base entries:\n\n${transcriptText}` }],
    1500
  )

  const fallback = [{
    topic_tag: topic.toLowerCase().replace(/\s+/g, '_'),
    question_framing: `What should I know about ${topic}?`,
    synthesized_answer: transcriptText.slice(0, 300),
    exposable_to_users: true
  }]

  const parsed = parseJSON(text, fallback)
  return Array.isArray(parsed) ? parsed : fallback
}

export async function handleUserQuery(
  question: string,
  kbResults: KBRow[],
  allSMEs: SMERow[]
): Promise<QueryResult> {
  const text = await askLLMText(
    buildQueryPrompt(kbResults, allSMEs),
    [{ role: 'user', content: question }],
    800
  )

  const fallback: Record<string, any> = { action: 'routed_admin', confidence_score: 0 }
  const parsed = parseJSON<Record<string, any>>(text, fallback)
  const validActions = ['answered', 'clarified', 'routed_sme', 'routed_admin']
  const action = validActions.includes(parsed.action) ? parsed.action : 'routed_admin'

  const routed_sme = parsed.routed_sme_email
    ? allSMEs.find(s => s.email === parsed.routed_sme_email)
    : undefined

  const routed_smes = parsed.routed_sme_emails?.length
    ? allSMEs.filter(s => parsed.routed_sme_emails.includes(s.email))
    : undefined

  return {
    action,
    answer: parsed.answer,
    clarifying_question: parsed.clarifying_question,
    routed_sme,
    routed_smes,
    routing_reason: parsed.routing_reason,
    kb_entries_used: parsed.kb_entry_ids || [],
    confidence_score: parsed.confidence_score || 0,
    sources: parsed.sources_used?.map((tag: string) => {
      const source = kbResults.find(e =>
        Array.isArray(e.topic_tag) ? e.topic_tag.includes(tag) : e.topic_tag === tag
      )
      return {
        topic_tag: tag,
        exposable_to_users: source?.exposable_to_users ?? false
      }
    })
  }
}

// ============================================
// EMBEDDINGS — triggered at admin publish time
// ============================================
export async function generateEmbedding(text: string): Promise<number[]> {
  if (process.env.OPENAI_API_KEY) {
    const { OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    })
    return response.data[0].embedding
  }

  if (process.env.HUGGINGFACE_API_KEY) {
    return generateEmbeddingHuggingFace(text)
  }

  throw new Error('No embedding provider. Add OPENAI_API_KEY or HUGGINGFACE_API_KEY to .env.local')
}

async function generateEmbeddingHuggingFace(text: string): Promise<number[]> {
  const urls = [
    'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction',
    'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
  ]

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true } })
      })

      if (!response.ok) { console.log(`[HF] ${url} returned ${response.status}`); continue }

      const data = await response.json()
      if (Array.isArray(data) && Array.isArray(data[0])) return padEmbedding(data[0])
      if (Array.isArray(data) && typeof data[0] === 'number') return padEmbedding(data)
      if (data.embeddings) return padEmbedding(data.embeddings[0])

      console.log(`[HF] Unexpected shape from ${url}`)
    } catch (err: any) {
      console.log(`[HF] ${url} threw: ${err.message}`)
    }
  }

  throw new Error('HuggingFace embedding failed. Check your HUGGINGFACE_API_KEY.')
}

function padEmbedding(embedding: number[], dimensions: number = 1536): number[] {
  if (embedding.length === dimensions) return embedding
  if (embedding.length > dimensions) return embedding.slice(0, dimensions)
  return [...embedding, ...Array(dimensions - embedding.length).fill(0)]
}

// Alias for v1 benchmark routes
export const embedQuery = generateEmbedding
