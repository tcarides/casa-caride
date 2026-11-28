import { NextRequest, NextResponse } from 'next/server'
import { requireReady } from '@/lib/guard'
import { fetchDirectory } from '@/lib/directory'

export const dynamic = 'force-dynamic'

/** Directorio para el selector de vínculo. El shell ya lo abre a cualquier logueado. */
export async function GET(req: NextRequest) {
  const ready = await requireReady(req)
  if ('res' in ready) return ready.res
  return NextResponse.json(await fetchDirectory(req.headers.get('cookie') ?? '') ?? [])
}
