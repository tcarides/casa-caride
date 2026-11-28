import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { isViewingAs } from '@/lib/identity'
import { ensureMonth, listMovimientos, listPersonas } from '@/lib/db'

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

  // Ver como: no generar los fijos del mes (eso escribe). Se lee lo que ya está.
  const movimientos = (await isViewingAs()) ? await listMovimientos(periodo) : await ensureMonth(periodo)
  const personas = await listPersonas()
  return NextResponse.json({ periodo, personas, movimientos })
}
