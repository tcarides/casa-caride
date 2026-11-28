import { createZoneIdentity } from '@casa/view-as/identity'

// Identidad efectiva de la zona. Con "ver como", email y rol son los de la
// persona impersonada: un admin mirando como Clara no ve las listas de él.
const zone = createZoneIdentity()

export async function currentUser(): Promise<{ email: string; name: string; role: string } | null> {
  const u = await zone.currentViewer()
  return u ? { email: u.email, name: u.name, role: u.role } : null
}

export async function isViewingAs(): Promise<boolean> {
  return zone.isViewingAs()
}
