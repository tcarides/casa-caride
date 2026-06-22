import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listUsers } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Directorio de usuarios registrados (nombre + email). Solo el admin: el resto
// no necesita el listado completo (las zonas filtran por contexto compartido).
export async function GET() {
  const session = await auth()
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const users = await listUsers()
  return NextResponse.json(users.map((u) => ({ name: u.name, email: u.email })))
}
