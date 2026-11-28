import { NextRequest, NextResponse } from 'next/server'
import { requireReady } from '@/lib/guard'
import { listCuentas, createCuenta } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ready = await requireReady(req)
  if ('res' in ready) return ready.res
  return NextResponse.json(await listCuentas(ready.user))
}

export async function POST(req: NextRequest) {
  const ready = await requireReady(req)
  if ('res' in ready) return ready.res
  const b = (await req.json().catch(() => ({}))) as { name?: string }
  const name = (b.name ?? '').trim().slice(0, 80)
  if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  const id = await createCuenta(name, ready.user)
  return NextResponse.json({ id }, { status: 201 })
}
