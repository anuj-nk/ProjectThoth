// ============================================
// TEST SCRIPT: KB Entry Synthesis
// Reads last-transcript.json and runs
// synthesizeKBEntries() to produce KB entries
//
// Run with:
//   npx dotenv -e .env.local -- tsx src/scripts/test-synthesis.ts
// ============================================

import fs from 'fs'
import path from 'path'
import { synthesizeKBEntries } from '../lib/claude'
import type { InterviewMessage } from '../types'

// ─── Load transcript ───────────────────────────────────────
const transcriptPath = path.join(process.cwd(), 'src/scripts/last-transcript.json')

if (!fs.existsSync(transcriptPath)) {
  console.error('❌ No transcript found. Run test-interview-auto.ts first.')
  process.exit(1)
}

const { domain, transcript } = JSON.parse(fs.readFileSync(transcriptPath, 'utf8')) as {
  domain: string
  transcript: InterviewMessage[]
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log('\n================================================')
  console.log('PROJECT THOTH — Synthesis Test')
  console.log(`Domain: ${domain}`)
  console.log(`Transcript turns: ${transcript.length}`)
  console.log('================================================\n')

  console.log('Running synthesizeKBEntries()...\n')

  const entries = await synthesizeKBEntries(transcript, domain)

  console.log(`\n✅ Generated ${entries.length} KB entries:\n`)
  console.log('================================================\n')

  entries.forEach((entry, i) => {
    console.log(`Entry ${i + 1}:`)
    console.log(`  topic_tag:          ${entry.topic_tag}`)
    console.log(`  question_framing:   ${entry.question_framing}`)
    console.log(`  synthesized_answer: ${entry.synthesized_answer}`)
    console.log(`  exposable_to_users: ${entry.exposable_to_users}`)
    console.log()
  })

  // Check for issues
  console.log('================================================')
  console.log('Quality checks:')

  const issues: string[] = []

  entries.forEach((e, i) => {
    if (!e.topic_tag.match(/^[a-z_]+$/))
      issues.push(`Entry ${i + 1}: topic_tag "${e.topic_tag}" is not snake_case`)
    if (!e.question_framing.includes('?'))
      issues.push(`Entry ${i + 1}: question_framing doesn't look like a question`)
    if (e.synthesized_answer.split('. ').length > 5)
      issues.push(`Entry ${i + 1}: synthesized_answer may be too long (>4 sentences)`)
    if (e.synthesized_answer.toLowerCase().includes('patrick'))
      issues.push(`Entry ${i + 1}: synthesized_answer contains SME name — should be removed`)
  })

  if (issues.length === 0) {
    console.log('✅ All entries look good!\n')
  } else {
    console.log('⚠️  Issues found:')
    issues.forEach(i => console.log(`  - ${i}`))
    console.log()
  }

  // Save output
  const outPath = path.join(process.cwd(), 'src/scripts/last-kb-entries.json')
  fs.writeFileSync(outPath, JSON.stringify(entries, null, 2))
  console.log(`💾 Saved → src/scripts/last-kb-entries.json`)
  console.log('\nNext: review entries, then insert them into Supabase via test-seed-db.ts')
  console.log('================================================\n')
}

main().catch(console.error)
