import { supabaseAdmin } from '@/lib/supabase'
import type { DomainEntry, TopicEntry } from '@/lib/taxonomy-types'

function canonicalize(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function normalizeText(raw: string): string {
  return raw.toLowerCase().trim()
}

function normalizeTopicRow(row: any): TopicEntry {
  return {
    id: row.id,
    display: row.display,
    domain: row.domain,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    parent_id: row.parent_id ?? null,
    owner_sme_id: row.owner_sme_id ?? null,
    exposable: row.exposable ?? true,
    routing_note: row.routing_note ?? null,
  }
}

export async function getDomainValues(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('sme_domains')
    .select('value')
    .eq('active', true)
    .order('value')

  if (error) throw error
  return (data ?? []).map(row => row.value)
}

export async function getActiveDomainsFromDb(category?: string): Promise<DomainEntry[]> {
  let query = supabaseAdmin
    .from('sme_domains')
    .select('value, label, category, active')
    .eq('active', true)
    .order('category')
    .order('label')

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as DomainEntry[]
}

export async function getTopicsByDomainFromDb(
  domain?: string,
  includeNonExposable = true
): Promise<TopicEntry[]> {
  let query = supabaseAdmin
    .from('sme_topics')
    .select('id, display, domain, aliases, parent_id, owner_sme_id, exposable, routing_note')
    .order('domain')
    .order('display')

  if (domain) query = query.eq('domain', domain)
  if (!includeNonExposable) query = query.eq('exposable', true)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(normalizeTopicRow)
}

export async function normalizeDomainFromDb(raw: unknown): Promise<string | null> {
  if (!raw || typeof raw !== 'string') return null

  const lower = normalizeText(raw)
  if (!lower) return null

  const snake = canonicalize(raw)
  const compact = lower.replace(/[^\w]+/g, ' ').trim()
  const candidates = Array.from(new Set([lower, snake, compact].filter(Boolean)))

  const { data: exact, error: exactError } = await supabaseAdmin
    .from('sme_domains')
    .select('value')
    .in('value', candidates)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (exactError) throw exactError
  if (exact?.value) return exact.value

  const { data: alias, error: aliasError } = await supabaseAdmin
    .from('sme_domain_aliases')
    .select('domain_value')
    .in('alias', candidates)
    .limit(1)
    .maybeSingle()

  if (aliasError) throw aliasError
  return alias?.domain_value ?? null
}

function matchTopic(raw: string, topics: TopicEntry[]): string | null {
  const q = normalizeText(raw)
  const snake = canonicalize(raw)

  for (const topic of topics) {
    if (topic.id === q || topic.id === snake) return topic.id
    if (normalizeText(topic.display) === q || canonicalize(topic.display) === snake) return topic.id
    if (topic.aliases.some(alias => normalizeText(alias) === q || canonicalize(alias) === snake)) {
      return topic.id
    }
  }

  for (const topic of topics) {
    if (normalizeText(topic.display).includes(q) || q.includes(topic.id) || snake.includes(topic.id)) {
      return topic.id
    }
    if (topic.aliases.some(alias => {
      const aliasText = normalizeText(alias)
      const aliasSnake = canonicalize(alias)
      return aliasText.includes(q) || q.includes(aliasText) || snake.includes(aliasSnake)
    })) {
      return topic.id
    }
  }

  return null
}

export async function normalizeTopicFromDb(raw: string, domain?: string): Promise<string | null> {
  const topics = await getTopicsByDomainFromDb(domain, true)
  return matchTopic(raw, topics)
}

export async function normalizeTopicsFromDb(
  raws: string[],
  domain?: string
): Promise<{ matched: string[]; unmatched: string[] }> {
  const topics = await getTopicsByDomainFromDb(domain, true)
  const matched: string[] = []
  const unmatched: string[] = []

  for (const raw of raws) {
    const id = matchTopic(raw, topics)
    if (id && !matched.includes(id)) matched.push(id)
    else if (!id) unmatched.push(raw)
  }

  return { matched, unmatched }
}
