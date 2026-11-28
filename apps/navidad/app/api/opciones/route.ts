import { NextRequest, NextResponse } from 'next/server'
import { requireDeseo } from '@/lib/guard'
import { addOpcion } from '@/lib/db'
import { parseOpcion, opcionVacia } from '@/lib/parse'

export const dynamic = 'force-dynamic'

/** Agregar una opción (alternativa) a un deseo. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const deseoId = Number(body?.deseoId)
  const gate = await requireDeseo(req, deseoId, 'read')
  if ('res' in gate) return gate.res

  const o = parseOpcion(body)
  if (opcionVacia(o)) return NextResponse.json({ error: 'opción vacía' }, { status: 400 })

  const id = await addOpcion(deseoId, o)
  return NextResponse.json({ id })
}
