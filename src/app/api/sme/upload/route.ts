// ============================================
// API: /api/sme/upload
// Upload supporting documents to Supabase Storage
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const interview_id = formData.get('interview_id') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const prefix = interview_id ? `${interview_id}/` : 'misc/'
    const fileName = `${prefix}${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { data, error } = await supabaseAdmin.storage
      .from('sme-docs')
      .upload(fileName, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      })

    if (error) throw error

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('sme-docs')
      .getPublicUrl(fileName)

    return NextResponse.json({
      doc_id: data.path,
      file_name: file.name,
      url: publicUrl
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
}
