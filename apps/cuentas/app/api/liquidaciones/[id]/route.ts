import { NextRequest, NextResponse } from 'next/server'
import { setLiquidacionPagado } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as { pagado?: boolean }
  await setLiquidacionPagado(id, b.pagado === true)
  return NextResponse.json({ ok: true })
}
