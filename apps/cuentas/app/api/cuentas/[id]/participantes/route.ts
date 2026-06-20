import { NextRequest, NextResponse } from 'next/server'
import { addParticipante } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cuentaId = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as { name?: string; alias?: string }
  const name = (b.name ?? '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  const alias = (b.alias ?? '').trim().slice(0, 120) || null
  await addParticipante(cuentaId, name, alias)
  return NextResponse.json({ ok: true }, { status: 201 })
}
