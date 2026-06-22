import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { addParticipante } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSession()
  if (denied) return denied
  const cuentaId = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as { name?: string; alias?: string; userEmail?: string; origen?: string }
  const name = (b.name ?? '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  const alias = (b.alias ?? '').trim().slice(0, 120) || null
  const userEmail = (b.userEmail ?? '').trim().toLowerCase().slice(0, 200) || null
  const origen = b.origen === 'grupo' ? 'grupo' : 'cuenta'
  await addParticipante(cuentaId, name, alias, userEmail, origen)
  return NextResponse.json({ ok: true }, { status: 201 })
}
