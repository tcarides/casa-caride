import { NextRequest, NextResponse } from 'next/server'
import { addParticipante } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cuentaId = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as { name?: string; alias?: string; userEmail?: string }
  const name = (b.name ?? '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  const alias = (b.alias ?? '').trim().slice(0, 120) || null
  const userEmail = (b.userEmail ?? '').trim().toLowerCase().slice(0, 200) || null
  await addParticipante(cuentaId, name, alias, userEmail)
  return NextResponse.json({ ok: true }, { status: 201 })
}
