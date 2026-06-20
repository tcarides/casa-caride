import { NextRequest, NextResponse } from 'next/server'
import {
  getCuenta, getParticipantes, getGastos, getLiquidaciones,
  closeCuenta, reopenCuenta, deleteCuenta,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const id = Number((await params).id)
  const cuenta = await getCuenta(id)
  if (!cuenta) return NextResponse.json({ error: 'no existe' }, { status: 404 })
  const [participantes, gastos, liquidaciones] = await Promise.all([
    getParticipantes(id), getGastos(id), getLiquidaciones(id),
  ])
  return NextResponse.json({ cuenta, participantes, gastos, liquidaciones })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const id = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as { action?: string }
  if (b.action === 'cerrar') await closeCuenta(id)
  else if (b.action === 'reabrir') await reopenCuenta(id)
  else return NextResponse.json({ error: 'acción inválida' }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await deleteCuenta(Number((await params).id))
  return NextResponse.json({ ok: true })
}
