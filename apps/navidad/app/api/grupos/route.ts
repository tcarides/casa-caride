import { NextRequest, NextResponse } from 'next/server'
import { requireReady } from '@/lib/guard'
import { listGrupos, createGrupo } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Listas que la persona puede ver (admin: todas). */
export async function GET(req: NextRequest) {
  const ready = await requireReady(req)
  if ('res' in ready) return ready.res
  return NextResponse.json({ grupos: await listGrupos(ready.user) })
}

/** Crear un grupo. Quien lo crea queda como miembro. */
export async function POST(req: NextRequest) {
  const ready = await requireReady(req)
  if ('res' in ready) return ready.res
  const body = await req.json().catch(() => null)
  const nombre = String(body?.nombre ?? '').trim()
  if (!nombre) return NextResponse.json({ error: 'falta nombre' }, { status: 400 })
  const id = await createGrupo(nombre, ready.user)
  return NextResponse.json({ id })
}
