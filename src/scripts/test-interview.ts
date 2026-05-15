// ============================================
// TEST SCRIPT: Seed-Driven Interview
// Loads general_sme.yaml and drives the
// interview using the actual seed questions
//
// Run with:
//   npx dotenv -e .env.local -- tsx src/scripts/test-interview.ts
// ============================================

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import readline from 'readline'
import type { InterviewMessage } from '../types'

// Load seed questions
const seedPath = path.join(process.cwd(), 'src/data/seed_questions/general_sme.yaml')
const seed = yaml.load(fs.readFileSync(seedPath, 'utf8')) as any

// Build system prompt from seed questions
function buildInterviewPrompt(seed: any): string {
  const formatQuestions = (arr: any[]) =>
    arr.map(q => `  - [${q.id}] ${q.question}`).join('\n')

  return `You are Thoth, a knowledge capture assistant for Project Thoth.

Your job is to interview a Subject Matter Expert (SME) about "${seed.domain_label}".
Reference SME type: ${seed.reference_sme}

You have a library of seed questions organized by category. Use them as your guide.
Ask ONE question at a time. Be conversational. Generate dynamic follow-ups based on answers.

ORCHESTRATION RULES:
${seed.orchestration_notes}

SEED QUESTIONS BY CATEGORY:

OPENING QUESTIONS (pick 1 to start):
${formatQuestions(seed.opening_questions)}

TACIT KNOWLEDGE PROBES (use 2-3 of these):
${formatQuestions(seed.tacit_knowledge_probes)}

BOUNDARY PROBES (use at least 1):
${formatQuestions(seed.boundary_probes)}

EVIDENCE PROBES (use at least 1):
${formatQuestions(seed.evidence_probes)}

EXPOSURE POLICY PROBES (use at least 1 — critical for routing):
${formatQuestions(seed.exposure_policy_probes)}

MAINTENANCE PROBES (use 1 near the end):
${formatQuestions(seed.maintenance_probes)}

CLOSING (end with this):
${formatQuestions(seed.closing)}

FLOW GUIDANCE:
- Aim for 10-15 total exchanges
- Do not skip boundary probes or evidence probes
- Generate natural follow-ups based on what the SME says
- When all major categories are covered, say EXACTLY:
  "I think I have a solid understanding. Let me prepare a summary for your review."
`
}

// LLM caller
async function callOpenRouter(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const FREE_MODELS = [
    'google/gemma-4-31b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
    'openai/gpt-oss-20b:free',
  ]

  for (const model of FREE_MODELS) {
    try {
      process.stdout.write(`[Thoth] Trying ${model}... `)
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Project Thoth'
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          temperature: 0.4,
          messages: [{ role: 'system', content: systemPrompt }, ...messages]
        })
      })

      if (response.status === 429) { console.log('rate limited'); continue }
      if (!response.ok) { console.log(`HTTP ${response.status}`); continue }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      if (!content) { console.log('empty response'); continue }

      console.log('✓')
      return content
    } catch (err: any) {
      console.log(`error: ${err.message}`)
      continue
    }
  }
  throw new Error('All models failed')
}

// Main
async function main() {
  const systemPrompt = buildInterviewPrompt(seed)
  const messages: { role: 'user' | 'assistant'; content: string }[] = []
  const transcript: InterviewMessage[] = []
  let turnCount = 0
  const MAX_TURNS = 15

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (prompt: string) => new Promise<string>(resolve => rl.question(prompt, resolve))

  console.log('\n========================================')
  console.log('PROJECT THOTH — Seed-Driven Interview')
  console.log(`Domain: ${seed.domain_label}`)
  console.log('You are playing the role of the SME.')
  console.log('Type "quit" to end early.')
  console.log('========================================\n')

  // Opening turn
  const opening = await callOpenRouter(systemPrompt, [
    { role: 'user', content: 'Hello, I am ready to start.' }
  ])
  messages.push({ role: 'user', content: 'Hello, I am ready to start.' })
  messages.push({ role: 'assistant', content: opening })
  transcript.push({ role: 'assistant', content: opening, timestamp: new Date().toISOString() })
  console.log(`\n🤖 Thoth: ${opening}\n`)

  // Conversation loop
  while (turnCount < MAX_TURNS) {
    const input = await ask('👤 You (SME): ')
    if (input.toLowerCase() === 'quit') break

    messages.push({ role: 'user', content: input })
    transcript.push({ role: 'sme', content: input, timestamp: new Date().toISOString() })
    turnCount++

    console.log(`\n[Turn ${turnCount}/${MAX_TURNS}]\n`)
    const response = await callOpenRouter(systemPrompt, messages)
    messages.push({ role: 'assistant', content: response })
    transcript.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() })
    console.log(`\n🤖 Thoth: ${response}\n`)

    if (response.includes('I think I have a solid understanding')) {
      console.log('✅ Interview complete!\n')
      break
    }
  }

  rl.close()

  // Save transcript for synthesis testing
  const outPath = path.join(process.cwd(), 'src/scripts/last-transcript.json')
  fs.writeFileSync(outPath, JSON.stringify({ domain: seed.domain, transcript }, null, 2))
  console.log(`💾 Saved to src/scripts/last-transcript.json`)
  console.log(`Total turns: ${turnCount}`)
  console.log('\nNext: run test-synthesis.ts to turn this into KB entries.')
}

main().catch(console.error)
