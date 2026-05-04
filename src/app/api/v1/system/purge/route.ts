import { NextRequest, NextResponse } from 'next/server'
import { requireBenchmarkAuth } from '@/lib/auth'
import { purgeAllData, supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const authError = requireBenchmarkAuth(req)
  if (authError) return authError

  try {
    await purgeAllData()

    // Clear Supabase Storage materials/ prefix
    try {
      const { data: files } = await supabaseAdmin.storage.from('sme-docs').list('materials')
      if (files?.length) {
        const paths = files.map((f: any) => `materials/${f.name}`)
        await supabaseAdmin.storage.from('sme-docs').remove(paths)
      }
    } catch { /* storage clear is best-effort */ }

    return NextResponse.json({ status: 'purged', message: 'All data cleared.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
