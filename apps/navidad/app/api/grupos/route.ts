import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { listGrupos, createGrupo } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Lista de grupos. */
export async function GET() {
  const unauth = await requireSession()
  if (unauth) return unauth
  return NextResponse.json({ grupos: await listGrupos() })
}

/** Crear un grupo. */
export async function POST(req: NextRequest) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const body = await req.json().catch(() => null)
  const nombre = String(body?.nombre ?? '').trim()
  if (!nombre) return NextResponse.json({ error: 'falta nombre' }, { status: 400 })
  const id = await createGrupo(nombre)
  return NextResponse.json({ id })
}
