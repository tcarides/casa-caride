import { NextRequest, NextResponse } from 'next/server'
import { deleteGasto, updateGasto } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const id = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as {
    descripcion?: string; monto?: number; pagadorId?: number
  }
  const descripcion = (b.descripcion ?? '').trim().slice(0, 120)
  const monto = Math.round(Number(b.monto) || 0)
  const pagadorId = Number(b.pagadorId)
  if (!descripcion || monto <= 0 || !pagadorId) {
    return NextResponse.json({ error: 'descripción, monto y pagador requeridos' }, { status: 400 })
  }
  await updateGasto(id, descripcion, monto, pagadorId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await deleteGasto(Number((await params).id))
  return NextResponse.json({ ok: true })
}
