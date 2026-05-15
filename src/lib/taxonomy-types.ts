export interface TopicEntry {
  id: string
  display: string
  domain: string
  aliases: string[]
  parent_id?: string | null
  owner_sme_id?: string | null
  exposable: boolean
  routing_note?: string | null
}

export interface DomainEntry {
  value: string
  label: string
  category: string
  active: boolean
}
