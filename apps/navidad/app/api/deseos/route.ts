import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { addDeseo } from '@/lib/db'
import { parseMoneda, parsePrioridad, parsePrecio, normUrl, textOrNull } from '@/lib/parse'

export const dynamic = 'force-dynamic'

/** Agregar un deseo a la lista de un participante. */
export async function POST(req: NextRequest) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const body = await req.json().catch(() => null)
  const participanteId = Number(body?.participanteId)
  const titulo = String(body?.titulo ?? '').trim()
  const link = normUrl(body?.link)
  if (!Number.isFinite(participanteId)) return NextResponse.json({ error: 'falta participante' }, { status: 400 })
  // Un deseo necesita al menos título o link.
  if (!titulo && !link) return NextResponse.json({ error: 'falta título o link' }, { status: 400 })

  const id = await addDeseo(participanteId, {
    titulo: titulo || (link ?? ''),
    link,
    imagenUrl: normUrl(body?.imagenUrl),
    precio: parsePrecio(body?.precio),
    moneda: parseMoneda(body?.moneda),
    prioridad: parsePrioridad(body?.prioridad),
    nota: textOrNull(body?.nota),
  })
  return NextResponse.json({ id })
}
