import { NextRequest, NextResponse } from 'next/server'
import { addGasto } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cuentaId = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as {
    descripcion?: string; monto?: number; pagadorId?: number
    comprobanteUrl?: string; comprobantePath?: string
  }
  const descripcion = (b.descripcion ?? '').trim().slice(0, 120)
  const monto = Math.round(Number(b.monto) || 0) // centavos
  const pagadorId = Number(b.pagadorId)
  if (!descripcion || monto <= 0 || !pagadorId) {
    return NextResponse.json({ error: 'descripción, monto y pagador requeridos' }, { status: 400 })
  }
  await addGasto(cuentaId, descripcion, monto, pagadorId, b.comprobanteUrl ?? null, b.comprobantePath ?? null)
  return NextResponse.json({ ok: true }, { status: 201 })
}
