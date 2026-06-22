import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import {
  getCuenta, getParticipantes, getGastos, getLiquidaciones,
  closeCuenta, reopenCuenta, deleteCuenta, getPendientes, setFecha,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number((await params).id)
  const cuenta = await getCuenta(id)
  if (!cuenta) return NextResponse.json({ error: 'no existe' }, { status: 404 })
  const [participantes, gastos, liquidaciones] = await Promise.all([
    getParticipantes(id), getGastos(id), getLiquidaciones(id),
  ])
  return NextResponse.json({ cuenta, participantes, gastos, liquidaciones })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as { action?: string; fecha?: string | null }

  // Fijar / limpiar la fecha del evento ('YYYY-MM-DD' o null).
  if (b.fecha !== undefined) {
    const f = b.fecha && /^\d{4}-\d{2}-\d{2}$/.test(b.fecha) ? b.fecha : null
    await setFecha(id, f)
    return NextResponse.json({ ok: true })
  }

  if (b.action === 'cerrar') {
    const pendientes = await getPendientes(id)
    if (pendientes.length > 0) {
      return NextResponse.json(
        { error: 'pendientes', pendientes: pendientes.map((p) => p.name) },
        { status: 409 },
      )
    }
    await closeCuenta(id)
  } else if (b.action === 'reabrir') {
    await reopenCuenta(id)
  } else {
    return NextResponse.json({ error: 'acción inválida' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  await deleteCuenta(Number((await params).id))
  return NextResponse.json({ ok: true })
}
