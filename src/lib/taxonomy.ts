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
