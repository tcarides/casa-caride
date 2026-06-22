import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { getGrupo, grupoOwner, getMiembros, deleteGrupo } from '@/lib/db'
import { currentEmail } from '@/lib/identity'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number((await params).id)
  const grupo = await getGrupo(id)
  if (!grupo) return NextResponse.json({ error: 'no existe' }, { status: 404 })
  if ((await grupoOwner(id)) !== (await currentEmail())) {
    return NextResponse.json({ error: 'sin acceso' }, { status: 403 })
  }
  return NextResponse.json({ grupo, miembros: await getMiembros(id) })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number((await params).id)
  if ((await grupoOwner(id)) !== (await currentEmail())) {
    return NextResponse.json({ error: 'sin acceso' }, { status: 403 })
  }
  await deleteGrupo(id)
  return NextResponse.json({ ok: true })
}
