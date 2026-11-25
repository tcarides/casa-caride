import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { updateOpcion, deleteOpcion, type OpcionPatch } from '@/lib/db'
import { parseMoneda, parsePrecio, normUrl, textOrNull } from '@/lib/parse'

export const dynamic = 'force-dynamic'

/** Editar una opción. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'body inválido' }, { status: 400 })

  const patch: OpcionPatch = {}
  if (body.titulo !== undefined) patch.titulo = textOrNull(body.titulo)
  if (body.link !== undefined) patch.link = body.link ? normUrl(body.link) : null
  if (body.imagenUrl !== undefined) patch.imagenUrl = body.imagenUrl ? normUrl(body.imagenUrl) : null
  if (body.precio !== undefined) patch.precio = parsePrecio(body.precio)
  if (body.moneda !== undefined) patch.moneda = parseMoneda(body.moneda)
  if (body.nota !== undefined) patch.nota = textOrNull(body.nota)

  await updateOpcion(Number(id), patch)
  return NextResponse.json({ ok: true })
}

/** Borrar una opción. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const { id } = await params
  await deleteOpcion(Number(id))
  return NextResponse.json({ ok: true })
}
