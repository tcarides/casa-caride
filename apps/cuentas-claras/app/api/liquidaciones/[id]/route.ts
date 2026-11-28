import { NextRequest, NextResponse } from 'next/server'
import { requireLiquidacion } from '@/lib/guard'
import { setLiquidacionPagado } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const gate = await requireLiquidacion(req, id, 'read')
  if ('res' in gate) return gate.res
  const b = (await req.json().catch(() => ({}))) as { pagado?: boolean }
  await setLiquidacionPagado(id, b.pagado === true)
  return NextResponse.json({ ok: true })
}
