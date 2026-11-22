import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { addParticipante } from '@/lib/db'
import { textOrNull } from '@/lib/parse'

export const dynamic = 'force-dynamic'

/** Agregar un participante a un grupo. */
export async function POST(req: NextRequest) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const body = await req.json().catch(() => null)
  const grupoId = Number(body?.grupoId)
  const nombre = String(body?.nombre ?? '').trim()
  if (!Number.isFinite(grupoId)) return NextResponse.json({ error: 'falta grupo' }, { status: 400 })
  if (!nombre) return NextResponse.json({ error: 'falta nombre' }, { status: 400 })
  const id = await addParticipante(grupoId, nombre, textOrNull(body?.emoji))
  return NextResponse.json({ id })
}
