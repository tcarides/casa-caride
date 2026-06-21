import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { currentUser } from '@/lib/identity'

export const dynamic = 'force-dynamic'

// Diagnóstico temporal: ¿llega la cookie de sesión a la zona y la podemos leer?
export async function GET() {
  const c = await cookies()
  const h = await headers()
  const user = await currentUser()
  return NextResponse.json({
    hasSession: !!user,
    cookieNames: c.getAll().map((x) => x.name),
    host: h.get('host'),
    xForwardedHost: h.get('x-forwarded-host'),
    xForwardedProto: h.get('x-forwarded-proto'),
  })
}
