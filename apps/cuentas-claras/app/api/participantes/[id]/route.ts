import { NextRequest, NextResponse } from 'next/server'
import { updateParticipante, deleteParticipante } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const id = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as { name?: string; alias?: string }
  const name = (b.name ?? '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  await updateParticipante(id, name, (b.alias ?? '').trim().slice(0, 120) || null)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await deleteParticipante(Number((await params).id))
  return NextResponse.json({ ok: true })
}
