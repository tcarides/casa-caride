import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { updateMovimiento, deleteMovimiento, restoreMovimiento, type MovimientoPatch } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Editar / marcar pagado / omitir-restaurar un movimiento. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'body inválido' }, { status: 400 })

  if (body.restore === true) {
    await restoreMovimiento(Number(id))
    return NextResponse.json({ ok: true })
  }

  const patch: MovimientoPatch = {}
  if (body.nombre !== undefined) patch.nombre = String(body.nombre)
  if (body.categoria !== undefined) patch.categoria = String(body.categoria)
  if (body.pagador !== undefined) patch.pagador = String(body.pagador)
  if (body.moneda !== undefined) patch.moneda = body.moneda === 'USD' ? 'USD' : 'ARS'
  if (body.monto !== undefined) patch.monto = Math.round(Number(body.monto))
  if (body.vencimiento !== undefined) patch.vencimiento = body.vencimiento ? String(body.vencimiento) : null
  if (body.pagado !== undefined) patch.pagado = Boolean(body.pagado)
  if (body.fechaPago !== undefined) patch.fechaPago = body.fechaPago ? String(body.fechaPago) : null
  if (body.medioPago !== undefined) patch.medioPago = body.medioPago ? String(body.medioPago) : null
  if (body.notas !== undefined) patch.notas = body.notas ? String(body.notas) : null

  await updateMovimiento(Number(id), patch)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const { id } = await params
  await deleteMovimiento(Number(id))
  return NextResponse.json({ ok: true })
}
