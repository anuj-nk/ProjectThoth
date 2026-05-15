// DB → spec field name translations

export type SpecSME = {
  sme_id: string
  name: string
  specialization: string
  sub_areas: string[]
  contact_email: string
  created_at: string
}

export type SpecEntry = {
  entry_id: string
  sme_id: string
  topic: string
  status: string        // spec status values
  content: string
  sources: { interviews: string[]; materials: string[] }
  created_at: string
  updated_at: string
}

export type SpecInterview = {
  interview_id: string
  sme_id: string
  topic: string
  status: string
  created_at: string
}

export type SpecMaterial = {
  material_id: string
  sme_id: string
  title: string
  file_type: string
  status: string
  created_at: string
}

// Status maps
const DB_TO_SPEC_STATUS: Record<string, string> = {
  draft: 'draft',
  pending_review: 'sme_approved',
  approved: 'approved',
  rejected: 'rejected',
  stale: 'approved',   // treat stale as approved for spec purposes
}

const SPEC_TO_DB_STATUS: Record<string, string> = {
  draft: 'draft',
  sme_approved: 'pending_review',
  approved: 'approved',
  rejected: 'rejected',
}

export function dbStatusToSpec(dbStatus: string): string {
  return DB_TO_SPEC_STATUS[dbStatus] ?? dbStatus
}

export function specStatusToDb(specStatus: string): string {
  return SPEC_TO_DB_STATUS[specStatus] ?? specStatus
}

export function dbSmeToSpec(row: any): SpecSME {
  return {
    sme_id: row.sme_id,
    name: row.full_name,
    specialization: row.domain,
    sub_areas: Array.isArray(row.topics) ? row.topics : [],
    contact_email: row.email,
    created_at: row.created_at,
  }
}

export function dbEntryToSpec(row: any): SpecEntry {
  // supporting_doc_ids stores {interviews:[...], materials:[...]} when created via v1 synthesis
  let interviews: string[] = []
  let materials: string[] = []
  const docs = row.supporting_doc_ids
  if (docs && typeof docs === 'object' && !Array.isArray(docs)) {
    interviews = Array.isArray(docs.interviews) ? docs.interviews : []
    materials  = Array.isArray(docs.materials)  ? docs.materials  : []
  }

  return {
    entry_id: row.entry_id,
    sme_id: row.sme_id,
    topic: Array.isArray(row.topic_tag) ? row.topic_tag[0] : (row.topic_tag ?? ''),
    status: dbStatusToSpec(row.status),
    content: row.synthesized_answer ?? '',
    sources: { interviews, materials },
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  }
}

export function dbInterviewToSpec(row: any): SpecInterview {
  return {
    interview_id: row.session_id,
    sme_id: row.sme_id,
    topic: row.topic ?? '',
    status: row.interview_status ?? 'in_progress',
    created_at: row.created_at,
  }
}

export function dbMaterialToSpec(row: any): SpecMaterial {
  return {
    material_id: row.material_id,
    sme_id: row.sme_id,
    title: row.title,
    file_type: row.file_type,
    status: row.status,
    created_at: row.created_at,
  }
}
