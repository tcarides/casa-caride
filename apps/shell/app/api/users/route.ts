import { NextResponse } from 'next/server'
import { listUsers } from '@/lib/db'
import { getViewer } from '@/lib/view-as'

export const dynamic = 'force-dynamic'

// Directorio de usuarios registrados (nombre + email). Solo el admin: el resto
// no necesita el listado completo (las zonas filtran por contexto compartido).
// Con "ver como", el rol es el de la persona impersonada.
export async function GET() {
  const { effective } = await getViewer()
  if (effective?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const users = await listUsers()
  return NextResponse.json(users.map((u) => ({ name: u.name, email: u.email })))
}
