import { NextRequest, NextResponse } from 'next/server'
import { requireDeseo } from '@/lib/guard'
import { updateDeseo, deleteDeseo, type DeseoPatch } from '@/lib/db'
import { parsePrioridad } from '@/lib/parse'

export const dynamic = 'force-dynamic'

/** Editar un deseo (título, prioridad, nota). Las opciones van por /api/opciones. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gate = await requireDeseo(req, Number(id), 'read')
  if ('res' in gate) return gate.res
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'body inválido' }, { status: 400 })

  const patch: DeseoPatch = {}
  if (body.titulo !== undefined) patch.titulo = String(body.titulo).trim()
  if (body.prioridad !== undefined) patch.prioridad = parsePrioridad(body.prioridad)
  if (body.nota !== undefined) patch.nota = body.nota ? String(body.nota).trim() : null
  if (body.opcionElegidaId !== undefined) {
    const n = Number(body.opcionElegidaId)
    patch.opcionElegidaId = Number.isFinite(n) ? n : null
  }

  await updateDeseo(Number(id), patch)
  return NextResponse.json({ ok: true })
}

/** Borrar un deseo (con sus opciones). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gate = await requireDeseo(req, Number(id), 'read')
  if ('res' in gate) return gate.res
  await deleteDeseo(Number(id))
  return NextResponse.json({ ok: true })
}
