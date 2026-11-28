import { NextRequest, NextResponse } from 'next/server'
import { requireParticipanteCuenta } from '@/lib/guard'
import { updateParticipante, deleteParticipante, setEstadoCarga, claimParticipante, unclaimParticipante, type EstadoCarga } from '@/lib/db'
import { setParticipanteUser } from '@/lib/access'
import { fetchDirectory } from '@/lib/directory'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const ESTADOS: EstadoCarga[] = ['pendiente', 'listo', 'sin_gastos']

export async function PATCH(req: NextRequest, { params }: Params) {
  const id = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as {
    name?: string; alias?: string; estado?: string; claim?: boolean; userEmail?: string | null
  }
  const links = b.userEmail !== undefined
  const gate = await requireParticipanteCuenta(req, id, links ? 'manage' : 'read')
  if ('res' in gate) return gate.res

  // Vincular el nombre libre a una cuenta de Casa Caride. El nombre no cambia.
  if (links) {
    const raw = b.userEmail == null ? '' : String(b.userEmail).trim().toLowerCase()
    if (!raw) {
      await setParticipanteUser(id, null)
    } else {
      if (!raw.includes('@')) return NextResponse.json({ error: 'email inválido' }, { status: 400 })
      const directory = await fetchDirectory(req.headers.get('cookie') ?? '')
      const known = directory?.find((u) => u.email.toLowerCase() === raw)
      if (!known) return NextResponse.json({ error: 'ese usuario no está en Casa Caride' }, { status: 400 })
      await setParticipanteUser(id, known.email.toLowerCase())
    }
    return NextResponse.json({ ok: true })
  }

  // "Este soy yo" / "no soy yo": vincula o suelta el participante a mi sesión.
  if (b.claim !== undefined) {
    if (b.claim) await claimParticipante(id, gate.user.email)
    else await unclaimParticipante(id, gate.user.email)
    return NextResponse.json({ ok: true })
  }

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

export async function DELETE(req: NextRequest, { params }: Params) {
  const id = Number((await params).id)
  const gate = await requireParticipanteCuenta(req, id, 'read')
  if ('res' in gate) return gate.res
  await deleteParticipante(id)
  return NextResponse.json({ ok: true })
}
