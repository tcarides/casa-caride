import { createZoneIdentity } from '@casa/view-as/identity'

// Lee la sesión JWT del shell (cookie reenviada por el rewrite + AUTH_SECRET común).
// userId ('tomi' | 'flori' | …) sale del token, o de la persona impersonada.
const zone = createZoneIdentity()

export async function currentUser(): Promise<{ email: string; name: string } | null> {
  const u = await zone.currentViewer()
  return u ? { email: u.email, name: u.name } : null
}

/** Identidad de la app ('tomi' | 'flori') derivada de la sesión de Google. */
export async function currentUserId(): Promise<'tomi' | 'flori' | null> {
  const u = await zone.currentViewer()
  return u?.userId === 'tomi' || u?.userId === 'flori' ? u.userId : null
}
