import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { ensureMonth, listPersonas } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PERIODO_RE = /^\d{4}-\d{2}$/

/** Estado de un mes: personas de la casa + movimientos (fijos ya generados). */
export async function GET(req: NextRequest) {
  const unauth = await requireSession()
  if (unauth) return unauth

  const periodo = req.nextUrl.searchParams.get('periodo') ?? ''
  if (!PERIODO_RE.test(periodo)) {
    return NextResponse.json({ error: 'periodo inválido (YYYY-MM)' }, { status: 400 })
  }

  const [movimientos, personas] = await Promise.all([ensureMonth(periodo), listPersonas()])
  return NextResponse.json({ periodo, personas, movimientos })
}
