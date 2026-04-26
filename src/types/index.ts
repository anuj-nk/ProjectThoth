// ============================================
// PROJECT THOTH - Core TypeScript Types
// ============================================

// --------------------------------------------
// SME Profile
// --------------------------------------------
export interface SMEProfile {
  id: string
  name: string
  role: string
  email: string
  contact_info: {
    slack?: string
    phone?: string
    calendar_link?: string
  }
  topics_owned: string[]
  topics_not_owned: string[]
  availability: 'available' | 'limited' | 'unavailable'
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateSMEProfile = Omit<SMEProfile, 'id' | 'created_at' | 'updated_at'>

// --------------------------------------------
// KB Entry
// --------------------------------------------
export type KBStatus = 'draft' | 'pending_sme' | 'pending_admin' | 'approved' | 'archived'
export type Visibility = 'internal' | 'user_visible'

export interface KBEntry {
  id: string
  sme_id: string
  topic: string
  subtopic?: string
  title: string
  content: string
  raw_transcript?: string        // never exposed to users
  status: KBStatus
  visibility: Visibility
  keywords: string[]
  confidence_hint: number
  review_date?: string
  reviewed_at?: string
  approved_by?: string
  embedding?: number[]
  created_at: string
  updated_at: string
  // Joined
  sme?: SMEProfile
  documents?: Document[]
}

export type CreateKBEntry = Omit<KBEntry, 'id' | 'created_at' | 'updated_at' | 'embedding' | 'sme' | 'documents'>

// --------------------------------------------
// Document
// --------------------------------------------
export interface Document {
  id: string
  kb_entry_id?: string
  sme_id: string
  file_name: string
  file_type: string
  storage_path: string
  extracted_text?: string
  visibility: Visibility
  uploaded_at: string
}

// --------------------------------------------
// Interview
// --------------------------------------------
export interface Interview {
  id: string
  sme_id: string
  kb_entry_id?: string
  topic: string
  messages: InterviewMessage[]
  status: 'in_progress' | 'completed' | 'abandoned'
  started_at: string
  completed_at?: string
}

export interface InterviewMessage {
  role: 'assistant' | 'sme'
  content: string
  timestamp: string
}

// --------------------------------------------
// Routing
// --------------------------------------------
export interface RoutingRule {
  id: string
  topic_pattern: string
  primary_sme_id?: string
  fallback_sme_id?: string
  escalate_to_admin: boolean
  priority: number
  created_at: string
}

// --------------------------------------------
// Query / User Flow
// --------------------------------------------
export type QueryAction = 'answered' | 'routed_sme' | 'routed_admin' | 'clarified' | 'escalated'

export interface QueryResult {
  action: QueryAction
  answer?: string
  clarifying_question?: string
  routed_sme?: SMEProfile
  routed_smes?: SMEProfile[]   // for overlapping expertise
  kb_entries_used?: string[]
  confidence_score?: number
  sources?: {
    title: string
    visibility: Visibility
  }[]
}

export interface QueryLog {
  id: string
  session_id: string
  question: string
  answer?: string
  action_taken: QueryAction
  kb_entries_used?: string[]
  sme_routed_to?: string
  confidence_score?: number
  was_helpful?: boolean
  asked_at: string
}

// --------------------------------------------
// Chat / Conversation
// --------------------------------------------
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: {
    action?: QueryAction
    routed_sme?: SMEProfile
    confidence?: number
    sources?: string[]
  }
}

// --------------------------------------------
// App Roles (for role-based UI switching)
// --------------------------------------------
export type AppRole = 'user' | 'sme' | 'admin'

export interface AppSession {
  role: AppRole
  sme_profile?: SMEProfile      // populated if role = 'sme'
  session_id: string            // anonymous ID for users
}
