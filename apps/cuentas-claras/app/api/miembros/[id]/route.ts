import { NextRequest, NextResponse } from 'next/server'
import { requireMiembro } from '@/lib/guard'
import { deleteMiembro, updateMiembro } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const id = Number((await params).id)
  const gate = await requireMiembro(req, id, 'manage')
  if ('res' in gate) return gate.res
  const b = (await req.json().catch(() => ({}))) as { name?: string; alias?: string; userEmail?: string }
  const name = (b.name ?? '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  const alias = (b.alias ?? '').trim().slice(0, 120) || null
  const userEmail = (b.userEmail ?? '').trim().toLowerCase().slice(0, 200) || null
  await updateMiembro(id, name, alias, userEmail)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const id = Number((await params).id)
  const gate = await requireMiembro(req, id, 'manage')
  if ('res' in gate) return gate.res
  await deleteMiembro(id)
  return NextResponse.json({ ok: true })
}
