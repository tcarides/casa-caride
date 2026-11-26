import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listUsers } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Directorio liviano (nombre + email) de los usuarios de Casa Caride. A
// diferencia de /api/users (solo admin), lo puede leer cualquier logueado: las
// apps lo usan para elegir con quién compartir (ej. la lista del súper). No
// expone roles ni permisos, solo el nombre para mostrar y el mail para el share.
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 })
  }
  const users = await listUsers()
  return NextResponse.json(
    users.map((u) => ({ name: u.name, email: u.email })),
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
