// ============================================
// PROJECT THOTH - Supabase Client
// ============================================

import { createClient } from '@supabase/supabase-js'
import type { SMEProfile, KBEntry, Document, Interview, QueryLog, RoutingRule } from '@/types'

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
  // Create a new SME profile
  async create(profile: Omit<SMEProfile, 'id' | 'created_at' | 'updated_at'>): Promise<SMEProfile> {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .insert(profile)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Get SME by email (used for "login")
  async getByEmail(email: string): Promise<SMEProfile | null> {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single()
    if (error) return null
    return data
  },

  // Get SME by ID
  async getById(id: string): Promise<SMEProfile | null> {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  },

  // Get all active SMEs
  async getAll(): Promise<SMEProfile[]> {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    return data || []
  },

  // Update SME profile
  async update(id: string, updates: Partial<SMEProfile>): Promise<SMEProfile> {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Find SMEs by topic (for routing)
  async findByTopic(topic: string): Promise<SMEProfile[]> {
    const { data, error } = await supabaseAdmin
      .from('sme_profiles')
      .select('*')
      .eq('is_active', true)
      .contains('topics_owned', [topic])
    if (error) throw error
    return data || []
  }
}

// ============================================
// KB ENTRY OPERATIONS
// ============================================

export const kbApi = {
  // Create a draft KB entry
  async create(entry: Omit<KBEntry, 'id' | 'created_at' | 'updated_at' | 'embedding' | 'sme' | 'documents'>): Promise<KBEntry> {
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .insert(entry)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Update a KB entry (used for approval workflow)
  async update(id: string, updates: Partial<KBEntry>): Promise<KBEntry> {
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Store embedding for a KB entry
  async storeEmbedding(id: string, embedding: number[]): Promise<void> {
    const { error } = await supabaseAdmin
      .from('knowledge_entries')
      .update({ embedding: JSON.stringify(embedding) })
      .eq('id', id)
    if (error) throw error
  },

  // Get entries by SME (for SME dashboard)
  async getBySME(sme_id: string): Promise<KBEntry[]> {
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .select('*, sme:sme_profiles(*), documents(*)')
      .eq('sme_id', sme_id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  // Get entries pending admin approval
  async getPendingAdmin(): Promise<KBEntry[]> {
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .select('*, sme:sme_profiles(*)')
      .eq('status', 'pending_admin')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  // Approve an entry (admin action)
  async approve(id: string, approved_by: string): Promise<KBEntry> {
    const review_date = new Date()
    review_date.setMonth(review_date.getMonth() + 6) // 6 month review cycle

    return kbApi.update(id, {
      status: 'approved',
      approved_by,
      reviewed_at: new Date().toISOString(),
      review_date: review_date.toISOString().split('T')[0]
    })
  },

  // Semantic search using pgvector
  async semanticSearch(
    embedding: number[],
    threshold: number = 0.75,
    limit: number = 5
  ): Promise<(KBEntry & { similarity: number })[]> {
    const { data, error } = await supabaseAdmin.rpc('match_kb_entries', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit
    })
    if (error) throw error
    return data || []
  },

  // Get entries due for review
  async getDueForReview(): Promise<KBEntry[]> {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .select('*, sme:sme_profiles(*)')
      .eq('status', 'approved')
      .lte('review_date', today)
      .order('review_date')
    if (error) throw error
    return data || []
  }
}

// ============================================
// DOCUMENT OPERATIONS
// ============================================

export const documentApi = {
  // Upload a file to Supabase Storage and record it
  async upload(
    file: File,
    sme_id: string,
    kb_entry_id?: string,
    visibility: 'internal' | 'user_visible' = 'internal'
  ): Promise<Document> {
    const fileName = `${sme_id}/${Date.now()}_${file.name}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('thoth-documents')
      .upload(fileName, file)
    if (uploadError) throw uploadError

    // Record in documents table
    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert({
        kb_entry_id,
        sme_id,
        file_name: file.name,
        file_type: file.name.split('.').pop() || 'unknown',
        storage_path: fileName,
        visibility
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Get signed URL for a document
  async getUrl(storage_path: string): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from('thoth-documents')
      .createSignedUrl(storage_path, 3600) // 1 hour
    if (error) throw error
    return data.signedUrl
  }
}

// ============================================
// INTERVIEW OPERATIONS
// ============================================

export const interviewApi = {
  async create(sme_id: string, topic: string): Promise<Interview> {
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .insert({ sme_id, topic, messages: [], status: 'in_progress' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Interview>): Promise<Interview> {
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getById(id: string): Promise<Interview | null> {
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  }
}

// ============================================
// QUERY LOG OPERATIONS
// ============================================

export const queryLogApi = {
  async log(entry: Omit<QueryLog, 'id' | 'asked_at'>): Promise<void> {
    await supabaseAdmin.from('query_logs').insert(entry)
  },

  async getStats(): Promise<{
    total: number
    answered: number
    routed: number
    avg_confidence: number
  }> {
    const { data, error } = await supabaseAdmin
      .from('query_logs')
      .select('action_taken, confidence_score')
    if (error) throw error

    const logs = data || []
    return {
      total: logs.length,
      answered: logs.filter(l => l.action_taken === 'answered').length,
      routed: logs.filter(l => l.action_taken.startsWith('routed')).length,
      avg_confidence: logs.reduce((sum, l) => sum + (l.confidence_score || 0), 0) / (logs.length || 1)
    }
  }
}
