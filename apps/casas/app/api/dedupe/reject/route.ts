import { NextRequest, NextResponse } from 'next/server'
import { rejectPair } from '@/lib/dedupeDb'

export async function POST(request: NextRequest) {
  const body = await request.json() as { propA?: string; propB?: string }
  if (!body.propA || !body.propB) {
    return NextResponse.json({ error: 'Missing propA or propB' }, { status: 400 })
  }
  await rejectPair(body.propA, body.propB)
  return NextResponse.json({ ok: true })
}
