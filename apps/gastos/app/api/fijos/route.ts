import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { listFijos, createFijo } from '@/lib/db'
import { parseFijo } from '@/lib/parse'

export const dynamic = 'force-dynamic'

export async function GET() {
  const unauth = await requireSession()
  if (unauth) return unauth
  return NextResponse.json(await listFijos())
}

export async function POST(req: NextRequest) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const body = await req.json().catch(() => null)
  const parsed = body && parseFijo(body)
  if (!parsed) return NextResponse.json({ error: 'falta nombre' }, { status: 400 })
  const id = await createFijo(parsed)
  return NextResponse.json({ id })
}
