// ============================================
// PROJECT THOTH — Topic Taxonomy
// Source of truth: src/data/topic_taxonomy.yaml
// This module provides client-safe TS constants derived from the YAML.
// ============================================

export interface TopicEntry {
  id: string
  display: string
  domain: string
  aliases: string[]
  parent_id?: string
  owner_sme_id?: string
  exposable: boolean
  routing_note?: string
}

// Career Services topic catalog — mirrors topic_taxonomy.yaml
// primary topics at top; out-of-scope topics at bottom
export const CAREER_SERVICES_TOPICS: TopicEntry[] = [
  {
    id: 'international_student',
    display: 'International Student (general)',
    domain: 'career_services',
    aliases: ['international', 'f1', 'f-1', 'international student'],
    exposable: true,
  },
  {
    id: 'visa',
    display: 'Visa & Work Authorization',
    domain: 'career_services',
    aliases: ['visa', 'work authorization', 'h1b', 'stem opt'],
    exposable: true,
  },
  {
    id: 'cpt',
    display: 'CPT – Curricular Practical Training',
    domain: 'career_services',
    aliases: ['cpt', 'curricular practical training', 'myisss'],
    exposable: true,
  },
  {
    id: 'opt',
    display: 'OPT – Optional Practical Training',
    domain: 'career_services',
    aliases: ['opt', 'optional practical training', 'stem opt'],
    exposable: true,
  },
  {
    id: 'i20',
    display: 'I-20 / SEVIS',
    domain: 'career_services',
    aliases: ['i-20', 'sevis', 'i20', 'immigration document'],
    exposable: true,
  },
  {
    id: 'internship',
    display: 'Internship & Co-op',
    domain: 'career_services',
    aliases: ['internship', 'co-op', 'coop', 'practicum', 'work experience'],
    exposable: true,
  },
  {
    id: 'techin_601',
    display: 'TECHIN 601 (Capstone enrollment)',
    domain: 'career_services',
    aliases: ['techin 601', '601', 'capstone course', 'capstone enrollment'],
    exposable: true,
  },
  {
    id: 'internship_search',
    display: 'Internship Search & Job Strategy',
    domain: 'career_services',
    aliases: ['job search', 'internship search', 'career strategy', 'job hunting'],
    exposable: true,
  },
  {
    id: 'offer_negotiation',
    display: 'Offer Negotiation',
    domain: 'career_services',
    aliases: ['negotiation', 'salary negotiation', 'offer evaluation', 'counter offer'],
    exposable: true,
  },
  {
    id: 'career_coaching',
    display: 'Career Coaching',
    domain: 'career_services',
    aliases: ['career coaching', 'coaching', 'career counseling', '1:1'],
    exposable: true,
  },
  {
    id: 'industry_networking',
    display: 'Industry Networking',
    domain: 'career_services',
    aliases: ['networking', 'industry connections', 'alumni network'],
    exposable: true,
  },
  // Out-of-scope (exposable: false or owned elsewhere)
  {
    id: 'fee_waiver',
    display: 'Fee Waiver / Payment Issues',
    domain: 'career_services',
    aliases: ['fee waiver', 'financial waiver', 'payment issue'],
    exposable: false,
    routing_note: 'Route to Patrick Chidsey — case-by-case, never answer directly',
  },
  {
    id: 'course_petitions',
    display: 'MSTI Course Petitions',
    domain: 'career_services',
    aliases: ['course petition', 'petition', 'independent study'],
    owner_sme_id: 'jason_evans',
    exposable: true,
  },
  {
    id: 'transcripts',
    display: 'Academic Transcripts & Records',
    domain: 'career_services',
    aliases: ['transcript', 'academic records', 'official transcript'],
    owner_sme_id: 'jason_evans',
    exposable: true,
  },
]

// Flat map for fast id → entry lookup
export const TOPIC_BY_ID: Record<string, TopicEntry> = Object.fromEntries(
  CAREER_SERVICES_TOPICS.map(t => [t.id, t])
)

// Normalize a free-text topic string to a taxonomy id.
// Returns null if no match — caller should queue to admin.
export function normalizeTopic(raw: string): string | null {
  const q = raw.toLowerCase().trim()
  for (const topic of CAREER_SERVICES_TOPICS) {
    if (topic.id === q) return topic.id
    if (topic.display.toLowerCase() === q) return topic.id
    if (topic.aliases.some(a => a.toLowerCase() === q)) return topic.id
  }
  // Partial match fallback
  for (const topic of CAREER_SERVICES_TOPICS) {
    if (topic.display.toLowerCase().includes(q) || q.includes(topic.id)) return topic.id
    if (topic.aliases.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))) return topic.id
  }
  return null
}

// ============================================
// SME DOMAIN — keep aligned with the DB CHECK constraint
// (sme_profiles.domain in supabase/migrations/001_initial_schema.sql)
// ============================================
export const VALID_DOMAINS = [
  'academics',
  'career_services',
  'facilities',
  'prototyping_lab',
  'admissions',
  'it_purchasing',
  'student_wellbeing',
  'other',
] as const

// Map common display-form / human-typed variants to the canonical enum value.
// Anything not in this map but already-canonical passes through unchanged.
const DOMAIN_ALIASES: Record<string, typeof VALID_DOMAINS[number]> = {
  // career_services
  'career services': 'career_services',
  'careers': 'career_services',
  'career': 'career_services',
  'career_services_industry_engagement': 'career_services',
  'career services & industry engagement': 'career_services',
  // student_wellbeing
  'student wellbeing': 'student_wellbeing',
  'student well-being': 'student_wellbeing',
  'wellbeing': 'student_wellbeing',
  'wellness': 'student_wellbeing',
  // facilities
  'facility': 'facilities',
  'fab lab': 'prototyping_lab',
  'fabrication lab': 'prototyping_lab',
  'prototyping': 'prototyping_lab',
  'prototype lab': 'prototyping_lab',
  // it_purchasing
  'it': 'it_purchasing',
  'purchasing': 'it_purchasing',
  'it & purchasing': 'it_purchasing',
  'it/purchasing': 'it_purchasing',
  // academics
  'academic': 'academics',
  'academic services': 'academics',
  // admissions
  'admission': 'admissions',
}

// Normalize a domain string to the canonical DB enum value.
// Returns null if it can't be mapped — caller should return a friendly 400
// instead of letting Postgres throw a check-constraint error to the UI.
export function normalizeDomain(raw: unknown): typeof VALID_DOMAINS[number] | null {
  if (!raw || typeof raw !== 'string') return null
  const lower = raw.toLowerCase().trim()
  if (!lower) return null
  // already-canonical (snake_case enum value)
  if ((VALID_DOMAINS as readonly string[]).includes(lower)) return lower as typeof VALID_DOMAINS[number]
  // exact alias
  if (DOMAIN_ALIASES[lower]) return DOMAIN_ALIASES[lower]
  // snake-cased version of input (e.g. "Career Services" -> "career_services")
  const snake = lower.replace(/[\s\-/&]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  if ((VALID_DOMAINS as readonly string[]).includes(snake)) return snake as typeof VALID_DOMAINS[number]
  if (DOMAIN_ALIASES[snake]) return DOMAIN_ALIASES[snake]
  return null
}

// Normalize an array of free-text topics, returning matched ids + unmatched strings
export function normalizeTopics(raws: string[]): {
  matched: string[]
  unmatched: string[]
} {
  const matched: string[] = []
  const unmatched: string[] = []
  for (const raw of raws) {
    const id = normalizeTopic(raw)
    if (id && !matched.includes(id)) matched.push(id)
    else if (!id) unmatched.push(raw)
  }
  return { matched, unmatched }
}
