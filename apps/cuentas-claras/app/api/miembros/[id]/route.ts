import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { miembroGrupo, grupoOwner, deleteMiembro, updateMiembro } from '@/lib/db'
import { currentEmail } from '@/lib/identity'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

async function ownsMiembro(id: number): Promise<boolean> {
  const grupoId = await miembroGrupo(id)
  return grupoId === undefined || (await grupoOwner(grupoId)) === (await currentEmail())
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number((await params).id)
  if (!(await ownsMiembro(id))) return NextResponse.json({ error: 'sin acceso' }, { status: 403 })
  const b = (await req.json().catch(() => ({}))) as { name?: string; alias?: string; userEmail?: string }
  const name = (b.name ?? '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  const alias = (b.alias ?? '').trim().slice(0, 120) || null
  const userEmail = (b.userEmail ?? '').trim().toLowerCase().slice(0, 200) || null
  await updateMiembro(id, name, alias, userEmail)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number((await params).id)
  if (!(await ownsMiembro(id))) return NextResponse.json({ error: 'sin acceso' }, { status: 403 })
  await deleteMiembro(id)
  return NextResponse.json({ ok: true })
}
