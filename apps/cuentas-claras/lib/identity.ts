import { createZoneIdentity } from '@casa/view-as/identity'

// Identidad en la zona: lee la sesión JWT del shell (cookie compartida en el
// apex + AUTH_SECRET común). Los grupos y las cuentas se filtran por este
// email: con "ver como", es el de la persona impersonada.
const zone = createZoneIdentity()

export async function currentEmail(): Promise<string | null> {
  const u = await zone.currentViewer()
  return u?.email ?? null
}

export async function currentUser(): Promise<{ email: string; name: string; role: string } | null> {
  const u = await zone.currentViewer()
  return u ? { email: u.email, name: u.name, role: u.role } : null
}
