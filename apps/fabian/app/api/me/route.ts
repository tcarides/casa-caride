import { NextResponse } from 'next/server'
import { currentUserId } from '@/lib/identity'

export const dynamic = 'force-dynamic'

// Identidad del usuario logueado (vía la sesión de Google del shell), para
// registrar quién le dio la pastilla a Fabián sin selector manual.
export async function GET() {
  return NextResponse.json({ userId: await currentUserId() })
}
