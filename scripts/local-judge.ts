/**
 * scripts/local-judge.ts
 *
 * Pre-submission self-evaluation. Hits /api/v1/query with the scenarios in
 * scripts/dialog-tests.json (single-turn + multi-turn) and uses an LLM-as-judge
 * to grade each turn against the test's expectations.
 *
 * The judge mirrors what the official benchmark seems to be scoring:
 *   * For grounded answers: presence of [KB-N] citations, no fabrication
 *   * For clarifications: did we ask back instead of guessing
 *   * For routing: did we pick the right route_type (sme vs admin), and not
 *     hallucinate an SME name when no SME owns the topic
 *   * For multi-turn: did we actually use the prior turn (refused to repeat
 *     the same question back, resolved pronouns, etc.)
 *
 * Usage:
 *   API_BASE=https://project-thoth.vercel.app/api/v1 \
 *   BENCHMARK_API_KEY=... \
 *   OPENROUTER_API_KEY=... \
 *     tsx scripts/local-judge.ts
 *
 *   # filter by category
 *   tsx scripts/local-judge.ts --only=multi-turn
 *
 *   # run against a local dev server
 *   API_BASE=http://localhost:3000/api/v1 tsx scripts/local-judge.ts
 *
 * Exits non-zero if average score is below PASS_THRESHOLD (default 70).
 */

import fs from 'fs'
import path from 'path'

type Turn = {
  q: string
  expect: {
    response_type?: 'answer' | 'clarification' | 'routing'
    must_cite_kb?: boolean
    must_not_fabricate?: boolean
    must_route_to_type?: 'sme' | 'admin'
    must_route_to_sme_name?: string
    must_reference_prior?: boolean
    prior_topic?: string
  }
}
type Case = { name: string; category: string; turns: Turn[] }

const API_BASE = process.env.API_BASE || 'https://project-thoth.vercel.app/api/v1'
const API_KEY = process.env.BENCHMARK_API_KEY
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const JUDGE_MODEL = process.env.JUDGE_MODEL || 'anthropic/claude-sonnet-4'
const PASS_THRESHOLD = parseInt(process.env.PASS_THRESHOLD || '70', 10)

if (!API_KEY) { console.error('ERROR: BENCHMARK_API_KEY not set.'); process.exit(1) }
if (!OPENROUTER_KEY) { console.error('ERROR: OPENROUTER_API_KEY not set (needed for the judge).'); process.exit(1) }

const onlyArg = process.argv.find(a => a.startsWith('--only='))?.split('=')[1]
const testsPath = path.join(process.cwd(), 'scripts/dialog-tests.json')
const allCases: Case[] = JSON.parse(fs.readFileSync(testsPath, 'utf8'))
const cases = onlyArg ? allCases.filter(c => c.category === onlyArg) : allCases

console.log(`\nThoth local judge`)
console.log(`API_BASE:  ${API_BASE}`)
console.log(`Cases:     ${cases.length}${onlyArg ? ` (filtered to category="${onlyArg}")` : ''}`)
console.log(`Judge:     ${JUDGE_MODEL}\n`)

async function postQuery(question: string, session_id: string) {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ question, session_id }),
  })
  const json = await res.json().catch(() => ({ error: 'non-json response' }))
  return { status: res.status, json }
}

const CITATION_RE = /\[KB-\d+(?:,\s*\d+)*\]/

async function judgeTurn(turn: Turn, response: any, priorTurns: Array<{q: string, a: string}>): Promise<{ score: number; reason: string }> {
  // Mechanical checks first (cheap, no LLM call needed)
  const mechanical: string[] = []
  const expect = turn.expect

  if (expect.response_type && response.response_type !== expect.response_type) {
    return { score: 0, reason: `response_type expected=${expect.response_type} got=${response.response_type}` }
  }
  if (expect.must_cite_kb) {
    if (!CITATION_RE.test(response.answer || '')) {
      mechanical.push('NO [KB-N] CITATION present')
    } else {
      mechanical.push('citation present')
    }
  }
  if (expect.must_route_to_type) {
    const types = (response.routed_to || []).map((r: any) => r.type)
    if (!types.includes(expect.must_route_to_type)) {
      return { score: 0, reason: `expected route type "${expect.must_route_to_type}" not in ${JSON.stringify(types)}` }
    }
    mechanical.push(`route type "${expect.must_route_to_type}" matched`)
  }
  if (expect.must_route_to_sme_name) {
    const names = (response.routed_to || []).map((r: any) => String(r.sme_name || '').toLowerCase())
    if (!names.includes(expect.must_route_to_sme_name.toLowerCase())) {
      return { score: 30, reason: `expected SME "${expect.must_route_to_sme_name}" not in routed_to (got ${JSON.stringify(names)})` }
    }
  }

  // LLM-as-judge for the qualitative checks
  const judgePrompt = `You are a strict grader for a knowledge-assistant agent called Thoth.

USER ASKED: ${JSON.stringify(turn.q)}

PRIOR CONVERSATION TURNS (for context, may be empty):
${priorTurns.map((t, i) => `Turn ${i+1}: User: ${t.q}\nThoth: ${t.a}`).join('\n\n') || '(none)'}

THOTH'S RESPONSE (full):
${JSON.stringify(response, null, 2)}

EXPECTATIONS:
${JSON.stringify(expect, null, 2)}

MECHANICAL CHECKS ALREADY PASSED:
${mechanical.join('; ') || '(none)'}

Grade Thoth on the following criteria (be strict):
1. Did it satisfy the EXPECTATIONS above?
2. If grounded answer: is it actually drawn from the knowledge base, not fabricated? Citations are present.
3. If multi-turn (prior turns exist) and expect.must_reference_prior=true: does the response acknowledge or build on the prior conversation? Resolves pronouns / "what about that" naturally?
4. Tone: concise (2-5 sentences), natural, not robotic. Does not over-disclaim.
5. If routing/clarification: is the wording helpful and human?

Return ONLY a JSON object (no prose, no code fences):
{"score": <0-100 integer>, "reason": "<one sentence explanation>"}`

  const judgeRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      max_tokens: 200,
      temperature: 0.0,
      messages: [{ role: 'user', content: judgePrompt }],
    }),
  })
  const judgeJson = await judgeRes.json().catch(() => null) as any
  const text: string = judgeJson?.choices?.[0]?.message?.content || ''
  try {
    const cleaned = text.replace(/^```json\s*/im, '').replace(/\s*```$/im, '').trim()
    const s = cleaned.search(/[[{]/)
    const e = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
    const parsed = JSON.parse(cleaned.slice(s, e + 1))
    return { score: Number(parsed.score) || 0, reason: String(parsed.reason || '') }
  } catch {
    return { score: 50, reason: `judge could not parse response: ${text.slice(0, 100)}` }
  }
}

;(async () => {
  const summary: Array<{ name: string; category: string; turns: number; avg: number; reasons: string[] }> = []
  let grandTotal = 0
  let grandCount = 0

  for (const tc of cases) {
    console.log(`── ${tc.name}  [${tc.category}] ──`)
    const session_id = `judge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const priorTurns: Array<{q: string, a: string}> = []
    const turnScores: number[] = []
    const reasons: string[] = []

    for (let i = 0; i < tc.turns.length; i++) {
      const turn = tc.turns[i]
      const { status, json } = await postQuery(turn.q, session_id)
      if (status >= 400) {
        console.log(`   T${i+1}  HTTP ${status}: ${JSON.stringify(json).slice(0, 120)}`)
        turnScores.push(0)
        reasons.push(`HTTP ${status}`)
        continue
      }
      const verdict = await judgeTurn(turn, json, priorTurns)
      turnScores.push(verdict.score)
      reasons.push(verdict.reason)
      console.log(`   T${i+1}  ${String(verdict.score).padStart(3, ' ')}  ${verdict.reason.slice(0, 100)}`)
      priorTurns.push({ q: turn.q, a: json.answer || '' })
    }

    const avg = turnScores.reduce((a, b) => a + b, 0) / Math.max(turnScores.length, 1)
    summary.push({ name: tc.name, category: tc.category, turns: tc.turns.length, avg, reasons })
    grandTotal += avg
    grandCount += 1
    console.log()
  }

  const overall = grandTotal / Math.max(grandCount, 1)
  console.log('═'.repeat(72))
  console.log('SUMMARY')
  console.log('═'.repeat(72))
  const byCategory = new Map<string, number[]>()
  for (const r of summary) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, [])
    byCategory.get(r.category)!.push(r.avg)
    console.log(`  ${String(Math.round(r.avg)).padStart(3, ' ')}  [${r.category.padEnd(10)}]  ${r.name}`)
  }
  console.log('─'.repeat(72))
  for (const [cat, scores] of byCategory) {
    const a = scores.reduce((x, y) => x + y, 0) / scores.length
    console.log(`  ${String(Math.round(a)).padStart(3, ' ')}  [${cat}]  ${scores.length} cases`)
  }
  console.log('─'.repeat(72))
  console.log(`  OVERALL: ${overall.toFixed(1)} / 100   (threshold: ${PASS_THRESHOLD})`)
  console.log('═'.repeat(72))

  process.exit(overall >= PASS_THRESHOLD ? 0 : 1)
})().catch(err => {
  console.error('FATAL:', err)
  process.exit(2)
})
