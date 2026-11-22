import { NextResponse } from 'next/server'
import { currentUser } from './identity'

// Blindaje real de las APIs de la zona: decodifica el JWT del shell (runtime
// Node, vía currentUser) y corta con 401 si no hay sesión válida. Complementa
// al middleware de presencia de cookie (que una cookie falsa podría pasar).
export async function requireSession(): Promise<NextResponse | null> {
  return (await currentUser()) ? null : NextResponse.json({ error: 'no autenticado' }, { status: 401 })
}
