// ============================================
// TEST SCRIPT: Fully Automated Interview
// LLM plays both Thoth and simulated SME
// Provider: OpenRouter free → Groq fallback
//
// Run with:
//   npx dotenv -e .env.local -- tsx src/scripts/test-interview-auto.ts
// ============================================

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import type { InterviewMessage } from '../types'

const seedPath = path.join(process.cwd(), 'src/data/seed_questions/career_services.yaml')
const seed = yaml.load(fs.readFileSync(seedPath, 'utf8')) as any

// ─── LLM caller with OpenRouter → Groq fallback ────────────
async function callLLM(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  label: string
): Promise<string> {
  const OPENROUTER_MODELS = [
    'google/gemma-4-31b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'microsoft/phi-4:free',
    'qwen/qwen3-8b:free',
    'openai/gpt-oss-20b:free',
  ]
  const GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
  ]

  const body = (model: string) => JSON.stringify({
    model,
    max_tokens: 400,
    temperature: 0.4,
    messages: [{ role: 'system', content: systemPrompt }, ...messages]
  })

  // Try OpenRouter
  for (const model of OPENROUTER_MODELS) {
    try {
      process.stdout.write(`  [${label}] OpenRouter:${model.split('/')[1]}... `)
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Project Thoth'
        },
        body: body(model)
      })
      if (res.status === 429 || !res.ok) { console.log(res.status === 429 ? 'rate limited' : `HTTP ${res.status}`); continue }
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content?.trim()
      if (!content) { console.log('empty'); continue }
      console.log('✓')
      return content
    } catch (e: any) { console.log(`error: ${e.message}`); continue }
  }

  // Groq fallback
  if (process.env.GROQ_API_KEY) {
    console.log(`  [${label}] OpenRouter exhausted → trying Groq...`)
    for (const model of GROQ_MODELS) {
      try {
        process.stdout.write(`  [${label}] Groq:${model}... `)
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: body(model)
        })
        if (res.status === 429 || !res.ok) { console.log(res.status === 429 ? 'rate limited' : `HTTP ${res.status}`); continue }
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content?.trim()
        if (!content) { console.log('empty'); continue }
        console.log('✓')
        return content
      } catch (e: any) { console.log(`error: ${e.message}`); continue }
    }
  }

  throw new Error(`All providers failed for ${label}`)
}

// ─── Thoth system prompt ────────────────────────────────────
function buildThothPrompt(seed: any): string {
  const fmt = (arr: any[]) => arr.map(q => `  - [${q.id}] ${q.question}`).join('\n')
  return `You are Thoth, a knowledge capture assistant. Interview an SME about "${seed.domain_label}".

Ask ONE question at a time. Be conversational. Use these seed questions as your guide and generate natural follow-ups.

OPENING (pick 1):
${fmt(seed.opening_questions)}

TACIT KNOWLEDGE PROBES (use 2-3):
${fmt(seed.tacit_knowledge_probes)}

BOUNDARY PROBES (use at least 1):
${fmt(seed.boundary_probes)}

EVIDENCE PROBES (use at least 1):
${fmt(seed.evidence_probes)}

EXPOSURE POLICY PROBES (use at least 1):
${fmt(seed.exposure_policy_probes)}

MAINTENANCE PROBES (use 1):
${fmt(seed.maintenance_probes)}

CLOSING:
${fmt(seed.closing)}

RULES:
- 10-15 turns total
- Always cover boundary probes and evidence probes before closing
- When done, say EXACTLY: "I think I have a solid understanding. Let me prepare a summary for your review."`
}

// ─── SME system prompt ──────────────────────────────────────
const SME_PROMPT = `You are Patrick Chidsey, Assistant Director of Career Services & Industry Engagement at GIX (University of Washington).

You are being interviewed by Thoth, an AI knowledge capture system. Answer naturally and helpfully, as if speaking to a colleague. Keep answers to 3-5 sentences.

Your knowledge:
- CPT applications: students must register for TECHIN 601 ($59/credit) FIRST, then file CPT at least 90 days before internship start
- OPT general guidance (but visa-specific questions go to ISS)
- Internship offer evaluation, negotiation, red flags to watch for
- Industry partner relationships, employer intelligence
- Resume reviews, interview prep, Handshake platform

What you do NOT own (redirect to others):
- F-1 visa status, travel restrictions, SEVIS → International Student Services (ISS)
- Academic advising, course selection → Kara or Jason
- Entrepreneurship / venture tracks → entrepreneurship team

Be specific and concrete. Mention edge cases and things students commonly get wrong.`

// ─── Main ──────────────────────────────────────────────────
async function main() {
  const thothPrompt = buildThothPrompt(seed)
  const thothMessages: { role: 'user' | 'assistant'; content: string }[] = []
  const smeMessages: { role: 'user' | 'assistant'; content: string }[] = []
  const transcript: InterviewMessage[] = []
  let turn = 0
  const MAX_TURNS = 14

  console.log('\n================================================')
  console.log('PROJECT THOTH — Fully Automated Interview Sim')
  console.log(`Domain: ${seed.domain_label}`)
  console.log('Simulated SME: Patrick Chidsey')
  console.log('================================================\n')

  // Turn 1: Thoth opens
  thothMessages.push({ role: 'user', content: 'Start the interview. Greet the SME and ask your opening question.' })
  const opening = await callLLM(thothPrompt, thothMessages, 'Thoth')
  thothMessages.push({ role: 'assistant', content: opening })
  transcript.push({ role: 'assistant', content: opening, timestamp: new Date().toISOString() })
  console.log(`\n🤖 Thoth: ${opening}\n`)

  let lastThothMessage = opening

  while (turn < MAX_TURNS) {
    turn++

    // SME responds
    smeMessages.push({ role: 'user', content: lastThothMessage })
    const smeResponse = await callLLM(SME_PROMPT, smeMessages, 'SME  ')
    smeMessages.push({ role: 'assistant', content: smeResponse })
    transcript.push({ role: 'sme', content: smeResponse, timestamp: new Date().toISOString() })
    console.log(`👤 Patrick: ${smeResponse}\n`)

    if (turn >= MAX_TURNS) { console.log('⚠️  Max turns reached.'); break }

    // Thoth responds
    thothMessages.push({ role: 'user', content: smeResponse })
    const thothResponse = await callLLM(thothPrompt, thothMessages, 'Thoth')
    thothMessages.push({ role: 'assistant', content: thothResponse })
    transcript.push({ role: 'assistant', content: thothResponse, timestamp: new Date().toISOString() })
    console.log(`🤖 Thoth: ${thothResponse}\n`)
    lastThothMessage = thothResponse

    if (thothResponse.includes('I think I have a solid understanding')) {
      console.log('✅ Interview complete!\n')
      break
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 800))
  }

  // Save transcript
  const outPath = path.join(process.cwd(), 'src/scripts/last-transcript.json')
  fs.writeFileSync(outPath, JSON.stringify({ domain: seed.domain, transcript }, null, 2))

  console.log('================================================')
  console.log(`✅ Done — ${turn} turns`)
  console.log(`💾 Saved → src/scripts/last-transcript.json`)
  console.log('Next: run test-synthesis.ts to generate KB entries.')
  console.log('================================================\n')
}

main().catch(console.error)