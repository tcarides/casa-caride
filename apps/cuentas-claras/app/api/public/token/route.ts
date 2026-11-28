import { NextRequest, NextResponse } from 'next/server'
import { findByToken } from '@/lib/access'

export const dynamic = 'force-dynamic'

// Pública: el shell la usa para convertir un link en invitación.
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') === 'cuenta' ? 'cuenta' : 'grupo'
  const t = req.nextUrl.searchParams.get('t') ?? ''
  const found = t ? await findByToken(kind, t) : null
  return NextResponse.json({ ok: !!found, nombre: found?.name ?? null })
}
