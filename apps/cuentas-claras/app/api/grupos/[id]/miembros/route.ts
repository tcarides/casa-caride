import { NextRequest, NextResponse } from 'next/server'
import { requireGrupo } from '@/lib/guard'
import { addMiembro } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const grupoId = Number((await params).id)
  const gate = await requireGrupo(req, grupoId, 'manage')
  if ('res' in gate) return gate.res
  const b = (await req.json().catch(() => ({}))) as { name?: string; alias?: string; userEmail?: string }
  const name = (b.name ?? '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  const userEmail = (b.userEmail ?? '').trim().toLowerCase().slice(0, 200) || null
  const alias = (b.alias ?? '').trim().slice(0, 120) || null
  await addMiembro(grupoId, name, alias, userEmail)
  return NextResponse.json({ ok: true }, { status: 201 })
}
