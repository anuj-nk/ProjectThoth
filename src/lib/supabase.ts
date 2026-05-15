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
    topic_guess?: string
    priority?: 'low' | 'normal' | 'high'
    assigned_sme_id?: string | null
  }) {
    const question = typeof entry.payload?.question === 'string'
      ? entry.payload.question.trim()
      : ''
    const normalizedQuestion = question.toLowerCase().replace(/\s+/g, ' ')

    if (entry.source === 'user_query' && normalizedQuestion) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('admin_queue')
        .select('*')
        .eq('source', entry.source)
        .eq('signal_type', entry.signal_type)
        .eq('payload->>normalized_question', normalizedQuestion)
        .in('status', ['pending', 'in_review', 'needs_sme'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingError) throw existingError

      if (existing) {
        const { data, error } = await supabaseAdmin
          .from('admin_queue')
          .update({
            occurrence_count: (existing.occurrence_count || 1) + 1,
            last_seen_at: new Date().toISOString(),
            payload: {
              ...(existing.payload || {}),
              latest_question: question,
              latest_session_id: entry.payload.session_id,
              kb_matches_found: entry.payload.kb_matches_found,
              highest_similarity: entry.payload.highest_similarity,
              confidence_score: entry.payload.confidence_score,
            }
          })
          .eq('queue_id', existing.queue_id)
          .select()
          .single()
        if (error) throw error
        return data
      }
    }

    const { data, error } = await supabaseAdmin
      .from('admin_queue')
      .insert({
        source: entry.source,
        signal_type: entry.signal_type,
        payload: normalizedQuestion
          ? { ...entry.payload, normalized_question: normalizedQuestion }
          : entry.payload,
        topic_guess: entry.topic_guess,
        priority: entry.priority || 'normal',
        assigned_sme_id: entry.assigned_sme_id || null,
        last_seen_at: new Date().toISOString(),
        status: 'pending'
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getPending() {
    const { data, error } = await supabaseAdmin
      .from('admin_queue')
      .select('*')
      .in('status', ['pending', 'in_review', 'needs_sme'])
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async assignSme(queue_id: string, assigned_sme_id: string, priority?: 'low' | 'normal' | 'high') {
    const { data, error } = await supabaseAdmin
      .from('admin_queue')
      .update({
        assigned_sme_id,
        priority: priority || 'normal',
        status: 'needs_sme'
      })
      .eq('queue_id', queue_id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async markNeedsSme(queue_id: string, topic_guess?: string, priority?: 'low' | 'normal' | 'high') {
    const { data, error } = await supabaseAdmin
      .from('admin_queue')
      .update({
        status: 'needs_sme',
        topic_guess,
        priority: priority || 'normal'
      })
      .eq('queue_id', queue_id)
      .select()
      .single()
    if (error) throw error
    return data
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

// ============================================
// MATERIALS OPERATIONS (v1 benchmark API)
// ============================================
export const materialsApi = {
  async create(material: {
    sme_id: string
    title: string
    description?: string
    file_type: string
    storage_path: string
    status?: string
  }) {
    const { data, error } = await supabaseAdmin
      .from('materials')
      .insert({ ...material, status: material.status || 'processed' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getBySME(sme_id: string) {
    const { data, error } = await supabaseAdmin
      .from('materials')
      .select('*')
      .eq('sme_id', sme_id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async getById(material_id: string) {
    const { data, error } = await supabaseAdmin
      .from('materials')
      .select('*')
      .eq('material_id', material_id)
      .single()
    if (error) return null
    return data
  },

  async deleteAll() {
    const { error } = await supabaseAdmin.from('materials').delete().neq('material_id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error
  }
}

// ============================================
// QUERY SESSION OPERATIONS (v1 benchmark API)
// ============================================
export const querySessionsApi = {
  async getOrCreate(session_id: string) {
    const { data: existing } = await supabaseAdmin
      .from('query_sessions')
      .select('*')
      .eq('session_id', session_id)
      .single()
    if (existing) return existing

    const { data, error } = await supabaseAdmin
      .from('query_sessions')
      .insert({ session_id, context: [] })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async appendTurn(session_id: string, turn: { question: string; answer: string; timestamp: string }) {
    const session = await querySessionsApi.getOrCreate(session_id)
    const context = [...(session.context || []), turn]
    const { data, error } = await supabaseAdmin
      .from('query_sessions')
      .update({ context, updated_at: new Date().toISOString() })
      .eq('session_id', session_id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteAll() {
    const { error } = await supabaseAdmin.from('query_sessions').delete().neq('session_id', '__never__')
    if (error) throw error
  }
}

// ============================================
// V1-SPECIFIC KB OPERATIONS
// ============================================
export const kbV1Api = {
  async getAll(statusFilter?: string) {
    let query = supabaseAdmin
      .from('knowledge_entries')
      .select('*, sme_profiles!knowledge_entries_sme_id_fkey(*)')
      .order('created_at', { ascending: false })
    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async smeApprove(entry_id: string, sme_id: string) {
    return kbApi.update(entry_id, {
      status: 'pending_review',
      approved_by_sme_id: sme_id,
      approved_at: new Date().toISOString()
    })
  },

  async adminApprove(entry_id: string) {
    return kbApi.update(entry_id, {
      status: 'approved',
      admin_approved_at: new Date().toISOString(),
      next_review_due: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString()
    })
  },

  async reject(entry_id: string, reason?: string) {
    return kbApi.update(entry_id, {
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason || null
    })
  },

  async deleteAll() {
    const { error } = await supabaseAdmin.from('knowledge_entries').delete().neq('entry_id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error
  },

  async semanticSearch(embedding: number[], threshold: number = 0.5, limit: number = 5) {
    const { data, error } = await supabaseAdmin.rpc('match_kb_entries', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit
    })
    if (error) throw error
    return data || []
  }
}

// ============================================
// V1-SPECIFIC INTERVIEW OPERATIONS
// ============================================
export const interviewV1Api = {
  async create(sme_id: string, topic: string) {
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .insert({
        sme_id,
        stage: 'interview_active',
        topic,
        interview_status: 'in_progress',
        message_history: [],
        draft_entries: []
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async appendTurn(session_id: string, userMsg: string, assistantMsg: string) {
    const session = await interviewApi.getById(session_id)
    if (!session) throw new Error('Interview not found')
    const history = session.message_history || []
    const ts = new Date().toISOString()
    history.push({ role: 'user', content: userMsg, timestamp: ts })
    history.push({ role: 'assistant', content: assistantMsg, timestamp: ts })
    return interviewApi.update(session_id, { message_history: history })
  },

  async complete(session_id: string) {
    return interviewApi.update(session_id, { interview_status: 'completed' })
  },

  async deleteAll() {
    const { error } = await supabaseAdmin.from('interview_sessions').delete().neq('session_id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error
  }
}

// ============================================
// PURGE — all data tables (FK order)
// ============================================
export async function purgeAllData() {
  await supabaseAdmin.from('query_sessions').delete().neq('session_id', '__never__')
  await supabaseAdmin.from('knowledge_entries').delete().neq('entry_id', '00000000-0000-0000-0000-000000000000')
  await supabaseAdmin.from('raw_transcripts').delete().neq('transcript_id', '00000000-0000-0000-0000-000000000000')
  await supabaseAdmin.from('interview_sessions').delete().neq('session_id', '00000000-0000-0000-0000-000000000000')
  await supabaseAdmin.from('materials').delete().neq('material_id', '00000000-0000-0000-0000-000000000000')
  await supabaseAdmin.from('admin_queue').delete().neq('queue_id', '00000000-0000-0000-0000-000000000000')
  await supabaseAdmin.from('sme_profiles').delete().neq('sme_id', '00000000-0000-0000-0000-000000000000')
}
