import { NextRequest, NextResponse } from 'next/server'
import { requireParticipante } from '@/lib/guard'
import { updateParticipante, deleteParticipante, type ParticipantePatch } from '@/lib/db'
import { setParticipanteUser } from '@/lib/access'
import { fetchDirectory } from '@/lib/directory'

export const dynamic = 'force-dynamic'

/** Editar apodo / emoji, o vincular la persona a un usuario sin cambiar el apodo. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'body inválido' }, { status: 400 })
  const links = body.userEmail !== undefined
  const gate = await requireParticipante(req, Number(id), links ? 'manage' : 'read')
  if ('res' in gate) return gate.res

  if (links) {
    const raw = body.userEmail == null ? '' : String(body.userEmail).trim().toLowerCase()
    if (!raw) {
      await setParticipanteUser(Number(id), null)
    } else {
      if (!raw.includes('@')) return NextResponse.json({ error: 'email inválido' }, { status: 400 })
      const directory = await fetchDirectory(req.headers.get('cookie') ?? '')
      const known = directory?.find((u) => u.email.toLowerCase() === raw)
      if (!known) return NextResponse.json({ error: 'ese usuario no está en Casa Caride' }, { status: 400 })
      await setParticipanteUser(Number(id), known.email.toLowerCase())
    }
  }

  const patch: ParticipantePatch = {}
  if (body.nombre !== undefined) patch.nombre = String(body.nombre).trim()
  if (body.emoji !== undefined) patch.emoji = body.emoji ? String(body.emoji).trim() : null
  if (patch.nombre !== undefined || patch.emoji !== undefined) {
    await updateParticipante(Number(id), patch)
  }
  return NextResponse.json({ ok: true })
}

/** Borrar un participante (con sus deseos). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gate = await requireParticipante(req, Number(id), 'read')
  if ('res' in gate) return gate.res
  await deleteParticipante(Number(id))
  return NextResponse.json({ ok: true })
}
