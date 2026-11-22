import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { getGrupoDetalle, renameGrupo, deleteGrupo } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Detalle de un grupo: participantes con sus deseos. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const { id } = await params
  const grupo = await getGrupoDetalle(Number(id))
  if (!grupo) return NextResponse.json({ error: 'no existe' }, { status: 404 })
  return NextResponse.json({ grupo })
}

/** Renombrar un grupo. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const { id } = await params
  const body = await req.json().catch(() => null)
  const nombre = String(body?.nombre ?? '').trim()
  if (!nombre) return NextResponse.json({ error: 'falta nombre' }, { status: 400 })
  await renameGrupo(Number(id), nombre)
  return NextResponse.json({ ok: true })
}

/** Borrar un grupo (con sus participantes y deseos). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const { id } = await params
  await deleteGrupo(Number(id))
  return NextResponse.json({ ok: true })
}
