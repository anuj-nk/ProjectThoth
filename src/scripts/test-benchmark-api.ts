/**
 * Smoke test for /api/v1/* benchmark endpoints.
 *
 * Run with:
 *   npx dotenv -e .env.local -- tsx src/scripts/test-benchmark-api.ts
 */

const BASE = process.env.BENCHMARK_BASE_URL || 'http://localhost:3000/api/v1'
const KEY = process.env.BENCHMARK_API_KEY || ''

if (!KEY) {
  console.error('BENCHMARK_API_KEY is not set. Add it to .env.local')
  process.exit(1)
}

const HEADERS = {
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const RESET = '\x1b[0m'

let passed = 0
let failed = 0

function ok(label: string, detail?: string) {
  console.log(`${GREEN}✓ PASS${RESET}  ${label}${detail ? ` — ${detail}` : ''}`)
  passed++
}

function fail(label: string, detail?: string) {
  console.log(`${RED}✗ FAIL${RESET}  ${label}${detail ? ` — ${detail}` : ''}`)
  failed++
}

async function req(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  })
  let data: any
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

async function run() {
  console.log(`\nProject Thoth — /api/v1/* Benchmark Smoke Test`)
  console.log(`Base URL: ${BASE}\n`)

  // ─── HEALTH ───────────────────────────────────────────────────────────────
  {
    const { status, data } = await req('GET', '/health')
    if (status === 200 && data?.status === 'healthy') ok('GET /health')
    else fail('GET /health', `status=${status} data=${JSON.stringify(data)}`)
  }

  // ─── CREATE SME ───────────────────────────────────────────────────────────
  let sme_id = ''
  {
    const { status, data } = await req('POST', '/smes', {
      name: 'Test SME',
      specialization: 'career_services',
      sub_areas: ['internship_eligibility', 'cpt_timeline'],
      contact_email: `smoke-test-${Date.now()}@example.com`,
    })
    if (status === 201 && data?.sme_id) {
      sme_id = data.sme_id
      ok('POST /smes', `sme_id=${sme_id}`)
    } else {
      fail('POST /smes', `status=${status} data=${JSON.stringify(data)}`)
    }
  }

  if (!sme_id) {
    fail('Aborting — no sme_id available for subsequent tests')
    return summary()
  }

  // ─── GET SME ──────────────────────────────────────────────────────────────
  {
    const { status, data } = await req('GET', `/smes/${sme_id}`)
    if (status === 200 && data?.sme_id === sme_id) ok(`GET /smes/${sme_id}`)
    else fail(`GET /smes/${sme_id}`, `status=${status}`)
  }

  // ─── LIST SMEs ────────────────────────────────────────────────────────────
  {
    const { status, data } = await req('GET', '/smes')
    if (status === 200 && Array.isArray(data?.smes)) ok('GET /smes (list)')
    else fail('GET /smes (list)', `status=${status}`)
  }

  // ─── CREATE INTERVIEW ─────────────────────────────────────────────────────
  let interview_id = ''
  {
    const { status, data } = await req('POST', `/smes/${sme_id}/interviews`, {
      topic: 'CPT Eligibility',
    })
    if (status === 201 && data?.interview_id) {
      interview_id = data.interview_id
      ok(`POST /smes/${sme_id}/interviews`, `interview_id=${interview_id}`)
    } else {
      fail(`POST /smes/${sme_id}/interviews`, `status=${status} data=${JSON.stringify(data)}`)
    }
  }

  if (!interview_id) {
    fail('Aborting — no interview_id available')
    return summary()
  }

  // ─── GET INTERVIEW ────────────────────────────────────────────────────────
  {
    const { status, data } = await req('GET', `/interviews/${interview_id}`)
    if (status === 200 && data?.interview_id === interview_id) ok(`GET /interviews/${interview_id}`)
    else fail(`GET /interviews/${interview_id}`, `status=${status}`)
  }

  // ─── POST TURNS (×3) ─────────────────────────────────────────────────────
  const smeResponses = [
    'CPT is available after one full academic year for F-1 students.',
    'Students must have a job offer letter and DSO approval before starting.',
    'Part-time CPT (under 20 hours) does not affect OPT eligibility.',
  ]

  for (let i = 0; i < smeResponses.length; i++) {
    const { status, data } = await req('POST', `/interviews/${interview_id}/turns`, {
      sme_response: smeResponses[i],
    })
    if (status === 200 && typeof data?.turn_number === 'number') {
      ok(`POST /interviews/${interview_id}/turns (turn ${i+1})`, data.usage ? `usage.total_tokens=${data.usage.total_tokens}` : 'no usage')
    } else {
      fail(`POST /interviews/${interview_id}/turns (turn ${i+1})`, `status=${status} data=${JSON.stringify(data)}`)
    }
  }

  // ─── LIST INTERVIEWS FOR SME ──────────────────────────────────────────────
  {
    const { status, data } = await req('GET', `/smes/${sme_id}/interviews`)
    if (status === 200 && Array.isArray(data?.interviews)) ok(`GET /smes/${sme_id}/interviews`)
    else fail(`GET /smes/${sme_id}/interviews`, `status=${status}`)
  }

  // ─── SYNTHESIZE KNOWLEDGE ─────────────────────────────────────────────────
  let entry_id = ''
  {
    const { status, data } = await req('POST', `/smes/${sme_id}/knowledge/synthesize`, {
      interview_ids: [interview_id],
      material_ids: [],
      topic: 'CPT Eligibility',
    })
    if (status === 201 && data?.entry_id) {
      entry_id = data.entry_id
      const hasUsage = data.usage && typeof data.usage.total_tokens === 'number'
      ok(`POST /smes/${sme_id}/knowledge/synthesize`, `entry_id=${entry_id} usage_present=${hasUsage}`)
    } else {
      fail(`POST /smes/${sme_id}/knowledge/synthesize`, `status=${status} data=${JSON.stringify(data)}`)
    }
  }

  if (!entry_id) {
    fail('Aborting — no entry_id available')
    return summary()
  }

  // ─── GET KNOWLEDGE ENTRY ──────────────────────────────────────────────────
  {
    const { status, data } = await req('GET', `/knowledge/${entry_id}`)
    if (status === 200 && data?.entry_id === entry_id) ok(`GET /knowledge/${entry_id}`)
    else fail(`GET /knowledge/${entry_id}`, `status=${status}`)
  }

  // ─── LIST KNOWLEDGE ───────────────────────────────────────────────────────
  {
    const { status, data } = await req('GET', '/knowledge')
    if (status === 200 && Array.isArray(data?.entries)) ok('GET /knowledge (list)')
    else fail('GET /knowledge (list)', `status=${status}`)
  }

  // ─── SME APPROVE ─────────────────────────────────────────────────────────
  {
    const { status, data } = await req('POST', `/knowledge/${entry_id}/approve`)
    if (status === 200 && data?.status === 'sme_approved') ok(`POST /knowledge/${entry_id}/approve`)
    else fail(`POST /knowledge/${entry_id}/approve`, `status=${status} data=${JSON.stringify(data)}`)
  }

  // ─── LIST KNOWLEDGE FILTERED ──────────────────────────────────────────────
  {
    const { status, data } = await req('GET', '/knowledge?status=sme_approved')
    if (status === 200 && Array.isArray(data?.entries)) ok('GET /knowledge?status=sme_approved')
    else fail('GET /knowledge?status=sme_approved', `status=${status}`)
  }

  // ─── ADMIN APPROVE ────────────────────────────────────────────────────────
  {
    const { status, data } = await req('POST', `/knowledge/${entry_id}/admin-approve`)
    if (status === 200 && data?.status === 'approved') ok(`POST /knowledge/${entry_id}/admin-approve`)
    else fail(`POST /knowledge/${entry_id}/admin-approve`, `status=${status} data=${JSON.stringify(data)}`)
  }

  // ─── QUERY ────────────────────────────────────────────────────────────────
  {
    const session_id = `smoke-${Date.now()}`
    const { status, data } = await req('POST', '/query', {
      question: 'How long do I need to study before I can apply for CPT?',
      session_id,
    })
    if (status === 200 && data?.response_type && data?.usage) {
      ok('POST /query', `response_type=${data.response_type} usage.total_tokens=${data.usage.total_tokens}`)
    } else {
      fail('POST /query', `status=${status} data=${JSON.stringify(data)}`)
    }
  }

  // ─── SYSTEM RESET ────────────────────────────────────────────────────────
  {
    const { status, data } = await req('POST', '/system/reset')
    if (status === 200 && data?.status === 'reset') ok('POST /system/reset')
    else fail('POST /system/reset', `status=${status} data=${JSON.stringify(data)}`)
  }

  // ─── SYSTEM PURGE ─────────────────────────────────────────────────────────
  {
    const { status, data } = await req('POST', '/system/purge')
    if (status === 200 && data?.status === 'purged') ok('POST /system/purge')
    else fail('POST /system/purge', `status=${status} data=${JSON.stringify(data)}`)
  }

  summary()
}

function summary() {
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${GREEN}${passed} passed${RESET}  ${failed > 0 ? RED : ''}${failed} failed${RESET}`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
