import { NextRequest, NextResponse } from 'next/server'
import { requireGrupo } from '@/lib/guard'
import { addParticipante } from '@/lib/db'
import { textOrNull } from '@/lib/parse'

export const dynamic = 'force-dynamic'

/** Agregar un participante a un grupo. El nombre que se guarda es el apodo. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const grupoId = Number(body?.grupoId)
  const gate = await requireGrupo(req, grupoId, 'read')
  if ('res' in gate) return gate.res
  const nombre = String(body?.nombre ?? '').trim()
  if (!nombre) return NextResponse.json({ error: 'falta nombre' }, { status: 400 })
  const id = await addParticipante(gate.grupoId, nombre, textOrNull(body?.emoji))
  return NextResponse.json({ id })
}
