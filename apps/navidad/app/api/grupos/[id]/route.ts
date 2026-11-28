import { NextRequest, NextResponse } from 'next/server'
import { requireGrupo } from '@/lib/guard'
import { getGrupoDetalle, renameGrupo, deleteGrupo } from '@/lib/db'
import { listAcceso } from '@/lib/access'

export const dynamic = 'force-dynamic'

/** Detalle. Los emails de las personas solo viajan si podés administrar. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gate = await requireGrupo(req, Number(id), 'read')
  if ('res' in gate) return gate.res
  const grupo = await getGrupoDetalle(gate.grupoId)
  if (!grupo) return NextResponse.json({ error: 'no existe' }, { status: 404 })
  const canManage = gate.canManage
  const acceso = canManage ? await listAcceso(gate.grupoId) : []
  const participantes = canManage
    ? grupo.participantes
    : grupo.participantes.map((p) => ({ ...p, userEmail: null }))
  return NextResponse.json({
    grupo: {
      ...grupo,
      participantes,
      canManage,
      acceso,
      ownerEmail: canManage ? grupo.ownerEmail : null,
    },
  })
}

/** Renombrar un grupo (dueño o admin). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gate = await requireGrupo(req, Number(id), 'manage')
  if ('res' in gate) return gate.res
  const body = await req.json().catch(() => null)
  const nombre = String(body?.nombre ?? '').trim()
  if (!nombre) return NextResponse.json({ error: 'falta nombre' }, { status: 400 })
  await renameGrupo(gate.grupoId, nombre)
  return NextResponse.json({ ok: true })
}

/** Borrar un grupo (dueño o admin). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gate = await requireGrupo(req, Number(id), 'manage')
  if ('res' in gate) return gate.res
  await deleteGrupo(gate.grupoId)
  return NextResponse.json({ ok: true })
}
