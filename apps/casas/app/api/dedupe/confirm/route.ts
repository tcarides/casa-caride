import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { confirmGroup } from '@/lib/dedupeDb'

export async function POST(request: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const body = await request.json() as { propA?: string; propB?: string }
  if (!body.propA || !body.propB) {
    return NextResponse.json({ error: 'Missing propA or propB' }, { status: 400 })
  }
  await confirmGroup(body.propA, body.propB)
  return NextResponse.json({ ok: true })
}
