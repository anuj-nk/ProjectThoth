import { NextRequest, NextResponse } from 'next/server'

export function requireBenchmarkAuth(req: NextRequest): NextResponse | null {
  const auth = req.headers.get('authorization')
  const expected = `Bearer ${process.env.BENCHMARK_API_KEY}`
  if (!auth || auth !== expected) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    )
  }
  return null
}
