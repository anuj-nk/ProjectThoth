// ============================================
// PROJECT THOTH - Supabase Client
// ============================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client-side client (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client (service role - bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// ============================================
// SME PROFILE OPERATIONS
// ============================================

export const smeApi = {
  async create(profile: {
    full_name: string
    email: string
    title?: string
    domain: string
    topics?: any[]
    exclusions?: any[]
    routing_preferences?: any[]
    availability?: string
    profile_source_input?: string
  }) {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .insert(profile)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getByEmail(email: string) {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .select('*')
      .eq('email', email)
      .single()
    if (error) return null
    return data
  },

  async getById(sme_id: string) {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .select('*')
      .eq('sme_id', sme_id)
      .single()
    if (error) return null
    return data
  },

  async getAll() {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .select('*')
      .order('full_name')
    if (error) throw error
    return data || []
  },

  async update(sme_id: string, updates: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .update(updates)
      .eq('sme_id', sme_id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async findByTopic(topic: string) {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .select('*')
      .contains('topics', [topic])
    if (error) throw error
    return data || []
  }
}

// ============================================
// KNOWLEDGE ENTRY OPERATIONS
// ============================================

export const kbApi = {
  async create(entry: {
    sme_id: string
    topic_tag: string | string[]
    question_framing: string
    synthesized_answer: string
    supporting_doc_ids?: any[]
    exposable_to_users?: boolean
    raw_transcript_id?: string
    status?: string
  }) {
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .insert(entry)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(entry_id: string, updates: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .update(updates)
      .eq('entry_id', entry_id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getById(entry_id: string) {
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .select('*, sme_profiles!knowledge_entries_sme_id_fkey(*)')
      .eq('entry_id', entry_id)
      .single()
    if (error) return null
    return data
  },

  async storeEmbedding(entry_id: string, embedding: number[]) {
    const { error } = await supabaseAdmin
      .from('knowledge_entries')
      .update({ embedding })
      .eq('entry_id', entry_id)
    if (error) throw error
  },

  async getBySME(sme_id: string) {
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .select('*')
      .eq('sme_id', sme_id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  // Entries SME-approved, awaiting admin publish
  async getPendingAdmin() {
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .select('*, sme_profiles!knowledge_entries_sme_id_fkey(*)')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  // Admin publishes entry. SME approval already recorded approved_by_sme_id.
  async publish(entry_id: string) {
    const next_review_due = new Date()
    next_review_due.setMonth(next_review_due.getMonth() + 6)

    return kbApi.update(entry_id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
      next_review_due: next_review_due.toISOString()
    })
  },

  async reject(entry_id: string) {
    return kbApi.update(entry_id, { status: 'rejected' })
  },

  // SME approves draft — moves to pending_review
  async smeApprove(entry_id: string, sme_id: string) {
    return kbApi.update(entry_id, {
      status: 'pending_review',
      approved_by_sme_id: sme_id
    })
  },

  async semanticSearch(
    embedding: number[],
    threshold: number = 0.75,
    limit: number = 5
  ) {
    const { data, error } = await supabaseAdmin.rpc('match_kb_entries', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit
    })
    if (error) throw error
    return data || []
  },

  async getDueForReview() {
    const today = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .select('*, sme_profiles!knowledge_entries_sme_id_fkey(*)')
      .eq('status', 'approved')
      .lte('next_review_due', today)
      .order('next_review_due')
    if (error) throw error
    return data || []
  }
}

// ============================================
// INTERVIEW SESSION OPERATIONS
// ============================================

export const interviewApi = {
  async create(sme_id: string) {
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .insert({
        sme_id,
        stage: 'input_received',
        message_history: [],
        draft_entries: []
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(session_id: string, updates: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('session_id', session_id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getById(session_id: string) {
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .select('*')
      .eq('session_id', session_id)
      .single()
    if (error) return null
    return data
  },

  async getBySME(sme_id: string) {
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .select('*')
      .eq('sme_id', sme_id)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data || []
  }
}

// ============================================
// RAW TRANSCRIPT OPERATIONS
// ============================================

export const transcriptApi = {
  async create(sme_id: string, session_id: string, messages: any[], uploaded_doc_ids: string[] = []) {
    const { data, error } = await supabaseAdmin
      .from('raw_transcripts')
      .insert({ sme_id, session_id, messages, uploaded_doc_ids })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getById(transcript_id: string) {
    const { data, error } = await supabaseAdmin
      .from('raw_transcripts')
      .select('*')
      .eq('transcript_id', transcript_id)
      .single()
    if (error) return null
    return data
  }
}

// ============================================
// ADMIN QUEUE OPERATIONS (schema v0.3)
// Receives every "system can't handle" signal
// ============================================

export const adminQueueApi = {
  async create(entry: {
    source: 'user_query' | 'sme_intake'
    signal_type: string
    payload: Record<string, any>
  }) {
    const { data, error } = await supabaseAdmin
      .from('admin_queue')
      .insert({ ...entry, status: 'pending' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getPending() {
    const { data, error } = await supabaseAdmin
      .from('admin_queue')
      .select('*')
      .in('status', ['pending', 'in_review'])
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async resolve(queue_id: string, resolution: string, resolved_by: string) {
    const { data, error } = await supabaseAdmin
      .from('admin_queue')
      .update({
        status: 'resolved',
        resolution,
        resolved_by,
        resolved_at: new Date().toISOString()
      })
      .eq('queue_id', queue_id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async dismiss(queue_id: string) {
    const { data, error } = await supabaseAdmin
      .from('admin_queue')
      .update({ status: 'dismissed' })
      .eq('queue_id', queue_id)
      .select()
      .single()
    if (error) throw error
    return data
  }
}
