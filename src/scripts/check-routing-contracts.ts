import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const checks: Array<[string, boolean]> = []

const supabase = read('src/lib/supabase.ts')
const claude = read('src/lib/claude.ts')
const interviewRoute = read('src/app/api/sme/interview/route.ts')
const migrations = fs
  .readdirSync(path.join(root, 'supabase/migrations'))
  .filter(file => file.endsWith('.sql'))
  .map(file => read(`supabase/migrations/${file}`))
  .join('\n\n')

checks.push([
  'admin publish does not overwrite approved_by_sme_id with an admin string',
  !/async publish\([^)]*approved_by_sme_id[\s\S]*approved_by_sme_id/.test(supabase),
])

checks.push([
  'interview continuation does not send the latest SME message twice',
  !claude.includes("? [...history, { role: 'user' as const, content: smeInput }]"),
])

checks.push([
  'interview orchestrator loads runtime seed questions',
  interviewRoute.includes('loadSeedQuestions') && interviewRoute.includes('seed_questions'),
])

checks.push([
  'root migrations define topic_tag as text array',
  /topic_tag\s+TEXT\[\]/i.test(migrations) || /ALTER COLUMN topic_tag TYPE TEXT\[\]/i.test(migrations),
])

checks.push([
  'root migrations define admin_queue with signal_type and payload',
  /CREATE TABLE IF NOT EXISTS (public\.)?admin_queue/i.test(migrations)
    && /signal_type\s+TEXT/i.test(migrations)
    && /payload\s+JSONB/i.test(migrations),
])

checks.push([
  'root migrations define match_kb_entries RPC for RAG',
  /CREATE OR REPLACE FUNCTION (public\.)?match_kb_entries/i.test(migrations)
    && /query_embedding\s+vector\(1536\)/i.test(migrations),
])

const failed = checks.filter(([, ok]) => !ok)

if (failed.length > 0) {
  console.error('Routing contract check failed:')
  for (const [name] of failed) console.error(`- ${name}`)
  process.exit(1)
}

console.log(`Routing contract check passed (${checks.length} checks).`)
