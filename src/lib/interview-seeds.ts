import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

export interface SeedQuestionLibrary {
  source: string
  content: string
}

export interface AdaptiveInterviewPromptInput {
  topic?: string
  seedQuestions?: string
  smeProfile?: {
    full_name?: string
    title?: string
    domain?: string
    topics?: string[]
    exclusions?: string[]
    availability?: string
  } | null
  interviewPlan?: string[]
}

function readYamlAsString(filePath: string): string {
  const raw = fs.readFileSync(filePath, 'utf8')
  return yaml.dump(yaml.load(raw))
}

export function loadSeedQuestionLibrary(domain: string = 'general_sme'): SeedQuestionLibrary {
  const seedDir = path.join(process.cwd(), 'src/data/seed_questions')
  const fileName = `${domain || 'general_sme'}.yaml`
  const seedPath = path.join(seedDir, fileName)
  const fallbackPath = path.join(seedDir, 'general_sme.yaml')
  const legacyFallbackPath = path.join(seedDir, 'career_services.yaml')

  const target = fs.existsSync(seedPath)
    ? seedPath
    : fs.existsSync(fallbackPath)
      ? fallbackPath
      : legacyFallbackPath

  return {
    source: path.basename(target, '.yaml'),
    content: readYamlAsString(target),
  }
}

export function buildAdaptiveInterviewPrompt({
  topic,
  seedQuestions,
  smeProfile,
  interviewPlan = [],
}: AdaptiveInterviewPromptInput): string {
  const profileLines = [
    smeProfile?.full_name ? `Name: ${smeProfile.full_name}` : null,
    smeProfile?.title ? `Title / role: ${smeProfile.title}` : null,
    smeProfile?.domain ? `Domain: ${smeProfile.domain}` : null,
    smeProfile?.topics?.length ? `Owned topics: ${smeProfile.topics.join(', ')}` : null,
    smeProfile?.exclusions?.length ? `Explicit exclusions: ${smeProfile.exclusions.join(', ')}` : null,
    smeProfile?.availability ? `Availability notes: ${smeProfile.availability}` : null,
  ].filter(Boolean).join('\n')

  const topicBlock = topic
    ? `THIS INTERVIEW IS SCOPED TO TOPIC: "${topic}"
- Do NOT ask the SME to pick a topic; they already chose "${topic}".
- Stay on this topic unless the SME clearly identifies a missing or adjacent ownership area.
- Open with a concrete question adapted to "${topic}".`
    : `No single topic was selected. Start by asking which concrete responsibility or recurring question the SME wants to capture first.`

  const planBlock = interviewPlan.length
    ? interviewPlan.map((question, index) => `${index + 1}. ${question}`).join('\n')
    : 'No generated plan is available yet. Use the generic seed library and SME profile to choose the best next question.'

  const seedBlock = seedQuestions?.trim()
    ? seedQuestions
    : 'No seed library was loaded. Use the standard SME interview phases.'

  return `ADAPTIVE SME INTERVIEW INSTRUCTIONS

Adapt every question to the SME's role, domain, selected topics, exclusions, uploaded materials, and prior answers.
Do not ask seed questions verbatim when a more specific version would be clearer.
Ask exactly ONE question at a time.
Prefer concrete wording over generic wording.
If ownership is uncertain, ask a clarifying boundary question before assuming the SME owns the topic.

SME PROFILE CONTEXT:
${profileLines || 'No profile context available.'}

${topicBlock}

GENERATED INTERVIEW PLAN:
Use this plan as a guide, not a rigid script. Skip questions already answered and generate natural follow-ups when the SME reveals useful tacit knowledge.
${planBlock}

GENERAL SEED QUESTION PLAYBOOK:
${seedBlock}`
}
