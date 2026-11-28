import { createZoneIdentity } from '@casa/view-as/identity'

// Lee la sesión JWT del shell (cookie reenviada por el rewrite + AUTH_SECRET común).
const zone = createZoneIdentity()

export async function currentUser(): Promise<{ email: string; name: string } | null> {
  const u = await zone.currentViewer()
  return u ? { email: u.email, name: u.name } : null
}
