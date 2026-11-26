import { NextResponse } from 'next/server'
import { currentUser } from './identity'
import { canAccessList, isListOwner } from './db'

// Blindaje real de las APIs de la zona: decodifica el JWT del shell (runtime
// Node, vía currentUser) y corta con 401 si no hay sesión válida. Complementa
// al middleware de presencia de cookie (que una cookie falsa podría pasar).
export async function requireSession(): Promise<NextResponse | null> {
  return (await currentUser()) ? null : NextResponse.json({ error: 'no autenticado' }, { status: 401 })
}

export type User = { email: string; name: string }

// Devuelve el usuario logueado o una respuesta 401 lista para retornar.
export async function requireUser(): Promise<{ user: User } | { res: NextResponse }> {
  const user = await currentUser()
  if (!user) return { res: NextResponse.json({ error: 'no autenticado' }, { status: 401 }) }
  return { user }
}

// Usuario + acceso a la lista. 401 si no hay sesión, 400 si falta/mal el id,
// 403 si no tiene acceso a esa lista.
export async function requireListAccess(
  listId: number | null | undefined
): Promise<{ user: User; listId: number } | { res: NextResponse }> {
  const user = await currentUser()
  if (!user) return { res: NextResponse.json({ error: 'no autenticado' }, { status: 401 }) }
  if (listId == null || !Number.isFinite(listId)) {
    return { res: NextResponse.json({ error: 'falta la lista' }, { status: 400 }) }
  }
  if (!(await canAccessList(listId, user.email))) {
    return { res: NextResponse.json({ error: 'sin acceso a esta lista' }, { status: 403 }) }
  }
  return { user, listId }
}

// Igual que el anterior pero exige ser el dueño (para compartir / renombrar).
export async function requireListOwner(
  listId: number | null | undefined
): Promise<{ user: User; listId: number } | { res: NextResponse }> {
  const user = await currentUser()
  if (!user) return { res: NextResponse.json({ error: 'no autenticado' }, { status: 401 }) }
  if (listId == null || !Number.isFinite(listId)) {
    return { res: NextResponse.json({ error: 'falta la lista' }, { status: 400 }) }
  }
  if (!(await isListOwner(listId, user.email))) {
    return { res: NextResponse.json({ error: 'solo el dueño' }, { status: 403 }) }
  }
  return { user, listId }
}
