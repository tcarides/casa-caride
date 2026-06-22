import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { miembroGrupo, grupoOwner, deleteMiembro } from '@/lib/db'
import { currentEmail } from '@/lib/identity'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number((await params).id)
  const grupoId = await miembroGrupo(id)
  if (grupoId !== undefined && (await grupoOwner(grupoId)) !== (await currentEmail())) {
    return NextResponse.json({ error: 'sin acceso' }, { status: 403 })
  }
  await deleteMiembro(id)
  return NextResponse.json({ ok: true })
}
