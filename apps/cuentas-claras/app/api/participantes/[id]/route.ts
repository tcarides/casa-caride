import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { updateParticipante, deleteParticipante, setEstadoCarga, claimParticipante, unclaimParticipante, type EstadoCarga } from '@/lib/db'
import { currentEmail } from '@/lib/identity'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const ESTADOS: EstadoCarga[] = ['pendiente', 'listo', 'sin_gastos']

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as { name?: string; alias?: string; estado?: string; claim?: boolean }

  // "Este soy yo" / "no soy yo": vincula o suelta el participante a mi sesión.
  if (b.claim !== undefined) {
    const email = await currentEmail()
    if (!email) return NextResponse.json({ error: 'sin sesión' }, { status: 401 })
    if (b.claim) await claimParticipante(id, email)
    else await unclaimParticipante(id, email)
    return NextResponse.json({ ok: true })
  }

  // Cambio de estado de carga (toggle desde la lista de participantes).
  if (b.estado !== undefined) {
    if (!ESTADOS.includes(b.estado as EstadoCarga)) {
      return NextResponse.json({ error: 'estado inválido' }, { status: 400 })
    }
    await setEstadoCarga(id, b.estado as EstadoCarga)
    return NextResponse.json({ ok: true })
  }

  const name = (b.name ?? '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  await updateParticipante(id, name, (b.alias ?? '').trim().slice(0, 120) || null)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  await deleteParticipante(Number((await params).id))
  return NextResponse.json({ ok: true })
}

