import { NextRequest, NextResponse } from 'next/server'
import { getGrupoByToken } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Pública (sin login): dice si un token de lista es válido y el nombre del grupo.
// La usa el shell para convertir el link de la lista en una invitación real.
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t') ?? ''
  const g = t ? await getGrupoByToken(t) : null
  return NextResponse.json({ ok: !!g, nombre: g?.nombre ?? null })
}
