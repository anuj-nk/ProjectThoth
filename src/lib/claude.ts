// ============================================
// PROJECT THOTH - OpenRouter LLM Client
// ============================================

import type { SMEProfile, KBEntry, QueryResult, InterviewMessage } from '@/types'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

// ============================================
// FREE MODEL FALLBACK LIST
// Tries each in order if one is rate-limited
// ============================================
const FREE_MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-3-12b-it:free',
  'openai/gpt-oss-20b:free',
]

// Set to a paid model string for demo day, null = use free fallbacks
// e.g. 'anthropic/claude-sonnet-4-5' or 'google/gemini-flash-1.5'
const PRODUCTION_MODEL: string | null = null

// ============================================
// CORE LLM CALLER WITH AUTO-FALLBACK
// ============================================
async function callLLM(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number = 800,
  preferredModel?: string
): Promise<string> {
  const modelsToTry = PRODUCTION_MODEL
    ? [PRODUCTION_MODEL]
    : preferredModel
      ? [preferredModel, ...FREE_MODELS.filter(m => m !== preferredModel)]
      : FREE_MODELS

  const errors: string[] = []

  for (const model of modelsToTry) {
    try {
      console.log(`[Thoth] Trying: ${model}`)

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
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ]
        })
      })

      if (response.status === 429) {
        errors.push(`${model}: rate limited`)
        console.log(`[Thoth] ${model} rate limited, trying next...`)
        continue
      }

      if (!response.ok) {
        const errText = await response.text()
        errors.push(`${model}: HTTP ${response.status}`)
        continue
      }

      const data = await response.json()

      if (data.error) {
        errors.push(`${model}: ${data.error.message}`)
        continue
      }

      const content = data.choices?.[0]?.message?.content || ''
      if (!content) {
        errors.push(`${model}: empty response`)
        continue
      }

      console.log(`[Thoth] Success with: ${model}`)
      return content

    } catch (err: any) {
      errors.push(`${model}: ${err.message}`)
      continue
    }
  }

  throw new Error(`All models failed:\n${errors.join('\n')}`)
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
// PROMPT: SME INTERVIEW CONDUCTOR
// ============================================
const SME_INTERVIEW_SYSTEM_PROMPT = `You are Thoth, a knowledge capture assistant. Interview a Subject Matter Expert (SME) to capture their knowledge for an organizational knowledge base.

Ask ONE question at a time. Be conversational and concise.

PHASE 1 - SCOPE:
- What topic are we capturing today?
- What does this topic cover and what does it NOT cover?

PHASE 2 - CORE KNOWLEDGE:
- What are the 3-5 most important things people should know?
- What do people most commonly misunderstand?
- What questions do you get asked most often?

PHASE 3 - ROUTING:
- When should someone come to you vs. handle it themselves?
- Who covers related topics outside your scope?

PHASE 4 - WRAP UP:
- Is there anything important I have not asked about?

When all phases are done, say exactly: "I think I have a solid understanding. Let me prepare a summary for your review."

Start by greeting the SME and asking what topic they want to capture.`

// ============================================
// PROMPT: KB ENTRY SYNTHESIZER
// ============================================
const SYNTHESIS_SYSTEM_PROMPT = `You are a knowledge synthesis assistant. Given an interview transcript, create a structured knowledge base entry.

Return ONLY a valid JSON object. No markdown, no explanation, no code blocks. Raw JSON only.

Required format:
{
  "title": "Short descriptive title",
  "topic": "Main topic category",
  "subtopic": "Sub-category or null",
  "content": "3-4 paragraphs of organized knowledge. Include: what this covers, key facts, common questions answered, important boundaries.",
  "keywords": ["5 to 10 relevant search terms"],
  "confidence_hint": 0.9,
  "review_cadence": "quarterly",
  "routing_notes": "When to route to this SME vs handle directly",
  "visibility": "internal"
}

Rules:
- content must be 200-500 words
- Do NOT include the SME personal name in content
- Do NOT fabricate anything not in the transcript
- confidence_hint: 1.0 = very clear, 0.5 = vague
- review_cadence: monthly, quarterly, biannual, or annual
- visibility: internal or user_visible`

// ============================================
// PROMPT: USER QUERY HANDLER
// ============================================
const buildQueryPrompt = (
  kbResults: (KBEntry & { similarity: number })[],
  allSMEs: SMEProfile[]
) => `You are Thoth, a knowledge assistant. Answer questions using ONLY the knowledge base below.

RULES:
- KB has good answer (similarity > 0.7) -> action: "answered"
- Question is vague -> action: "clarified", ask ONE follow-up question
- KB empty but SME owns topic -> action: "routed_sme"
- Completely unknown -> action: "routed_admin"

KNOWLEDGE BASE:
${kbResults.length > 0
  ? kbResults.map((e, i) =>
    `[${i + 1}] "${e.title}" (match: ${(e.similarity * 100).toFixed(0)}%)\nTopic: ${e.topic}\n${e.content}`
  ).join('\n\n---\n\n')
  : 'EMPTY - no relevant entries found.'}

AVAILABLE SMEs:
${allSMEs.length > 0
  ? allSMEs.map(s =>
    `- ${s.name} (${s.role}): topics=[${s.topics_owned.join(', ')}] email=${s.email}`
  ).join('\n')
  : 'No SMEs registered yet.'}

Return ONLY valid JSON, no markdown:
{
  "action": "answered|clarified|routed_sme|routed_admin",
  "answer": "Full answer (only if action=answered)",
  "clarifying_question": "Your question (only if action=clarified)",
  "routed_sme_email": "email (only if routing to one SME)",
  "routed_sme_emails": ["email1","email2"],
  "routing_reason": "Why you are routing",
  "confidence_score": 0.85,
  "sources_used": ["title1"],
  "kb_entry_ids": ["uuid1"]
}`

// ============================================
// EXPORTED FUNCTIONS
// ============================================

export async function conductInterview(
  messages: InterviewMessage[],
  smeInput: string
): Promise<string> {
  const history = messages.map(m => ({
    role: m.role === 'sme' ? 'user' as const : 'assistant' as const,
    content: m.content
  }))

  const fullMessages = smeInput
    ? [...history, { role: 'user' as const, content: smeInput }]
    : [{ role: 'user' as const, content: 'Hello, ready to start.' }]

  return callLLM(SME_INTERVIEW_SYSTEM_PROMPT, fullMessages, 400)
}

export async function synthesizeKBEntry(
  transcript: InterviewMessage[],
  topic: string
): Promise<{
  title: string
  topic: string
  subtopic?: string
  content: string
  keywords: string[]
  confidence_hint: number
  review_cadence: string
  routing_notes: string
  visibility: 'internal' | 'user_visible'
}> {
  const transcriptText = transcript
    .map(m => `${m.role === 'assistant' ? 'Thoth' : 'SME'}: ${m.content}`)
    .join('\n\n')

  const text = await callLLM(
    SYNTHESIS_SYSTEM_PROMPT,
    [{
      role: 'user',
      content: `Synthesize this interview about "${topic}" into a KB entry:\n\n${transcriptText}`
    }],
    1500
  )

  const fallback = {
    title: `${topic} Knowledge Entry`,
    topic,
    content: transcriptText.slice(0, 500),
    keywords: [topic],
    confidence_hint: 0.5,
    review_cadence: 'quarterly',
    routing_notes: 'Contact SME directly for questions.',
    visibility: 'internal' as const
  }

  const parsed = parseJSON(text, fallback)
  if (parsed.visibility !== 'user_visible') parsed.visibility = 'internal'
  return parsed
}

export async function handleUserQuery(
  question: string,
  kbResults: (KBEntry & { similarity: number })[],
  allSMEs: SMEProfile[]
): Promise<QueryResult> {
  const text = await callLLM(
    buildQueryPrompt(kbResults, allSMEs),
    [{ role: 'user', content: question }],
    800
  )

  const fallback = { action: 'routed_admin' as const, confidence_score: 0 }
  const parsed = parseJSON(text, fallback)

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
    kb_entries_used: parsed.kb_entry_ids || [],
    confidence_score: parsed.confidence_score || 0,
    sources: parsed.sources_used?.map((title: string) => ({
      title,
      visibility: kbResults.find(e => e.title === title)?.visibility || 'internal'
    }))
  }
}

// ============================================
// EMBEDDINGS
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
    'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
  ]

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: true }
        })
      })

      if (!response.ok) {
        console.log(`[HF] ${url} returned ${response.status}`)
        continue
      }

      const data = await response.json()

      if (Array.isArray(data) && Array.isArray(data[0])) return data[0]
      if (Array.isArray(data) && typeof data[0] === 'number') return data
      if (data.embeddings) return data.embeddings[0]

      console.log(`[HF] Unexpected shape from ${url}`)
      continue

    } catch (err: any) {
      console.log(`[HF] ${url} threw: ${err.message}`)
      continue
    }
  }

  throw new Error('HuggingFace embedding failed on all URLs. Check your HUGGINGFACE_API_KEY.')
}