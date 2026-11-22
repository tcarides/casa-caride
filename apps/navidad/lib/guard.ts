import { NextResponse } from 'next/server'
import { hasSession } from './session'

// Blindaje de las APIs de la zona: corta con 401 si no llegó la cookie de
// sesión del shell. Gate por presencia de cookie (la zona no usa AUTH_SECRET).
export async function requireSession(): Promise<NextResponse | null> {
  return (await hasSession()) ? null : NextResponse.json({ error: 'no autenticado' }, { status: 401 })
}
