import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { addMovimiento } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PERIODO_RE = /^\d{4}-\d{2}$/

/** Alta de un gasto variable en un mes. */
export async function POST(req: NextRequest) {
  const unauth = await requireSession()
  if (unauth) return unauth

  const body = await req.json().catch(() => null)
  const periodo = String(body?.periodo ?? '')
  const nombre = String(body?.nombre ?? '').trim()
  if (!PERIODO_RE.test(periodo)) return NextResponse.json({ error: 'periodo inválido' }, { status: 400 })
  if (!nombre) return NextResponse.json({ error: 'falta nombre' }, { status: 400 })

  const id = await addMovimiento(periodo, {
    nombre,
    categoria: String(body?.categoria ?? 'Otros'),
    pagador: String(body?.pagador ?? 'Compartido'),
    monto: Math.round(Number(body?.monto ?? 0)),
    vencimiento: body?.vencimiento ? String(body.vencimiento) : null,
    pagado: body?.pagado !== false, // los variables se cargan ya pagados por default
    fechaPago: body?.fechaPago ? String(body.fechaPago) : null,
  })
  return NextResponse.json({ id })
}
