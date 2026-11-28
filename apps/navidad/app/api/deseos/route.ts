import { NextRequest, NextResponse } from 'next/server'
import { requireParticipante } from '@/lib/guard'
import { addDeseo } from '@/lib/db'
import { parsePrioridad, textOrNull, parseOpcion, opcionVacia } from '@/lib/parse'

export const dynamic = 'force-dynamic'

/** Agregar un deseo (concepto) a la lista de un participante, con sus opciones. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const participanteId = Number(body?.participanteId)
  const gate = await requireParticipante(req, participanteId, 'read')
  if ('res' in gate) return gate.res

  const opcionesRaw: unknown[] = Array.isArray(body?.opciones) ? body.opciones : []
  const opciones = opcionesRaw.map(parseOpcion).filter((o) => !opcionVacia(o))

  let titulo = String(body?.titulo ?? '').trim()
  if (!titulo) titulo = opciones.find((o) => o.link)?.link ?? ''
  if (!titulo) return NextResponse.json({ error: 'falta título o link' }, { status: 400 })

  const id = await addDeseo(participanteId, {
    titulo,
    prioridad: parsePrioridad(body?.prioridad),
    nota: textOrNull(body?.nota),
    opciones,
  })
  return NextResponse.json({ id })
}
