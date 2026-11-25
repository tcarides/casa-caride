import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { addOpcion } from '@/lib/db'
import { parseOpcion, opcionVacia } from '@/lib/parse'

export const dynamic = 'force-dynamic'

/** Agregar una opción (alternativa) a un deseo. */
export async function POST(req: NextRequest) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const body = await req.json().catch(() => null)
  const deseoId = Number(body?.deseoId)
  if (!Number.isFinite(deseoId)) return NextResponse.json({ error: 'falta deseo' }, { status: 400 })

  const o = parseOpcion(body)
  if (opcionVacia(o)) return NextResponse.json({ error: 'opción vacía' }, { status: 400 })

  const id = await addOpcion(deseoId, o)
  return NextResponse.json({ id })
}
