import { createZoneIdentity } from '@casa/view-as/identity'

// Identidad en la zona: lee la sesión JWT del shell (cookie compartida en el
// apex + AUTH_SECRET común). Con "ver como", el email y el rol son los de
// la persona impersonada.
const zone = createZoneIdentity()

export async function currentEmail(): Promise<string | null> {
  const u = await zone.currentViewer()
  return u?.email ?? null
}

export async function currentUser(): Promise<{ email: string; name: string; role: string } | null> {
  const u = await zone.currentViewer()
  return u ? { email: u.email, name: u.name, role: u.role } : null
}

export async function isViewingAs(): Promise<boolean> {
  return zone.isViewingAs()
}
