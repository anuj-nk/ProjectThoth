import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { smeApi, materialsApi, supabaseAdmin } from '@/lib/supabase'
import { dbMaterialToSpec } from '@/lib/v1-mappers'

const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/markdown']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ sme_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { sme_id } = await params
    const sme = await smeApi.getById(sme_id)
    if (!sme) return NextResponse.json({ error: 'SME not found', code: 'NOT_FOUND' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null
    const description = formData.get('description') as string | null

    if (!file || !title) return NextResponse.json({ error: 'Missing required fields: file, title', code: 'MISSING_FIELDS' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}`, code: 'INVALID_FILE_TYPE' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large. Maximum size is 10 MB', code: 'FILE_TOO_LARGE' }, { status: 400 })

    const materialId = crypto.randomUUID()
    const storagePath = `materials/${sme_id}/${materialId}/${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage.from('sme-docs').upload(storagePath, buffer, { contentType: file.type })
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    const row = await materialsApi.create({ sme_id, title, description: description || undefined, file_type: file.type, storage_path: storagePath, status: 'processed' })
    return NextResponse.json(dbMaterialToSpec(row), { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ sme_id: string }> }) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    const { sme_id } = await params
    const rows = await materialsApi.getBySME(sme_id)
    return NextResponse.json({ materials: rows.map(dbMaterialToSpec) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
