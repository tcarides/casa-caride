import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { updateParticipante, deleteParticipante, type ParticipantePatch } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Editar nombre / emoji de un participante. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'body inválido' }, { status: 400 })
  const patch: ParticipantePatch = {}
  if (body.nombre !== undefined) patch.nombre = String(body.nombre).trim()
  if (body.emoji !== undefined) patch.emoji = body.emoji ? String(body.emoji).trim() : null
  await updateParticipante(Number(id), patch)
  return NextResponse.json({ ok: true })
}

/** Borrar un participante (con sus deseos). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const { id } = await params
  await deleteParticipante(Number(id))
  return NextResponse.json({ ok: true })
}
