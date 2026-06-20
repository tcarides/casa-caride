import { NextRequest, NextResponse } from 'next/server'
import { grupoOwner, addMiembro } from '@/lib/db'
import { currentEmail } from '@/lib/identity'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const grupoId = Number((await params).id)
  if ((await grupoOwner(grupoId)) !== (await currentEmail())) {
    return NextResponse.json({ error: 'sin acceso' }, { status: 403 })
  }
  const b = (await req.json().catch(() => ({}))) as { name?: string; alias?: string }
  const name = (b.name ?? '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  await addMiembro(grupoId, name, (b.alias ?? '').trim().slice(0, 120) || null)
  return NextResponse.json({ ok: true }, { status: 201 })
}
