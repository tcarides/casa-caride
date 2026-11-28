import { NextRequest, NextResponse } from 'next/server'
import { requireGrupo } from '@/lib/guard'
import { getGrupo, getMiembros, deleteGrupo } from '@/lib/db'
import { listGrupoAcceso } from '@/lib/access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const gate = await requireGrupo(req, id, 'read')
  if ('res' in gate) return gate.res
  const grupo = await getGrupo(id)
  if (!grupo) return NextResponse.json({ error: 'no existe' }, { status: 404 })
  return NextResponse.json({
    grupo,
    miembros: await getMiembros(id),
    canManage: gate.canManage,
    acceso: gate.canManage ? await listGrupoAcceso(id) : [],
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const gate = await requireGrupo(req, id, 'manage')
  if ('res' in gate) return gate.res
  await deleteGrupo(id)
  return NextResponse.json({ ok: true })
}
