// ============================================
// PROJECT THOTH - Core TypeScript Types
// Matches actual Supabase schema exactly
// ============================================

// --------------------------------------------
// SME Profile (matches sme_profiles table)
// --------------------------------------------
export interface SMEProfile {
  sme_id: string
  full_name: string
  email: string
  title?: string
  domain: 'academics' | 'career_services' | 'facilities' | 'prototyping_lab' | 'admissions' | 'it_purchasing' | 'student_wellbeing' | 'other'
  topics: string[]
  exclusions: string[]
  routing_preferences: RoutingPreference[]
  availability?: string
  profile_source_input?: string
  created_at: string
  last_reviewed_at?: string
  next_review_due?: string
}

export interface RoutingPreference {
  channel: 'teams' | 'email' | 'scheduling_link' | 'in_person'
  priority: number
}

export type CreateSMEProfile = Omit<SMEProfile, 'sme_id' | 'created_at'>

// --------------------------------------------
// Knowledge Entry (matches knowledge_entries table)
// --------------------------------------------
export type KBStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'stale'

export interface KBEntry {
  entry_id: string
  sme_id: string
  topic_tag: string[]   // primary topic at [0]; secondary tags at [1..n] (schema v0.2)
  question_framing: string
  synthesized_answer: string
  supporting_doc_ids: string[]
  exposable_to_users: boolean
  raw_transcript_id?: string
  embedding?: number[]
  status: KBStatus
  approved_by_sme_id?: string
  approved_at?: string
  next_review_due?: string
  created_at: string
  // Joined (not in DB, populated via select)
  sme_profiles?: SMEProfile
}

export type CreateKBEntry = Omit<KBEntry, 'entry_id' | 'created_at' | 'embedding' | 'sme_profiles'>

// --------------------------------------------
// Raw Transcript (matches raw_transcripts table)
// Never exposed to end users — internal only
// --------------------------------------------
export interface RawTranscript {
  transcript_id: string
  sme_id: string
  session_id: string
  messages: InterviewMessage[]
  uploaded_doc_ids: string[]
  synthesized_entry_ids: string[]
  created_at: string
}

// --------------------------------------------
// Interview Session (matches interview_sessions table)
// --------------------------------------------
export type InterviewStage =
  | 'input_received'
  | 'extracting'
  | 'profile_review'
  | 'boundaries_routing'
  | 'interview_active'
  | 'synthesis_review'
  | 'completed'

export interface InterviewSession {
  session_id: string
  sme_id?: string
  stage: InterviewStage
  message_history: InterviewMessage[]
  draft_profile?: Partial<SMEProfile>
  draft_entries: Partial<KBEntry>[]
  created_at: string
  updated_at: string
}

export interface InterviewMessage {
  role: 'assistant' | 'sme'
  content: string
  timestamp: string
}

// --------------------------------------------
// Query / User Flow
// --------------------------------------------
export type QueryAction = 'answered' | 'routed_sme' | 'routed_admin' | 'clarified'

export interface QueryResult {
  action: QueryAction
  answer?: string
  clarifying_question?: string
  routed_sme?: SMEProfile
  routed_smes?: SMEProfile[]
  routing_reason?: string
  kb_entries_used: string[]
  confidence_score: number
  sources?: {
    topic_tag: string
    exposable_to_users: boolean
  }[]
}

// ============================================
// Admin Queue (schema v0.3)
// Receives every "system can't handle" signal
// Sources: user_query (low-confidence) + sme_intake (unmatched topics)
// ============================================
export type AdminQueueStatus = 'pending' | 'in_review' | 'resolved' | 'needs_sme' | 'dismissed'
export type AdminQueueSource = 'user_query' | 'sme_intake'

export interface AdminQueueEntry {
  queue_id: string
  source: AdminQueueSource
  signal_type: string           // e.g. 'low_confidence_query' | 'unmatched_topic' | 'routed_admin'
  status: AdminQueueStatus
  payload: Record<string, any>  // original query text, unmatched topic strings, etc.
  resolution?: string
  resolved_by?: string
  created_at: string
  resolved_at?: string
}

// query_logs table is planned for CI-2, not yet built
export interface QueryLog {
  query_id: string
  query_text: string
  resolution_path: 'kb_answer' | 'sme_redirect' | 'admin_fallback' | 'clarification_asked'
  matched_entry_ids: string[]
  routed_to_sme_id?: string
  confidence_score: number
  created_at: string
}

// --------------------------------------------
// Chat / Conversation (UI only, not persisted)
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
// App Roles
// --------------------------------------------
export type AppRole = 'user' | 'sme' | 'admin'

export interface AppSession {
  role: AppRole
  sme_profile?: SMEProfile
  session_id: string
}