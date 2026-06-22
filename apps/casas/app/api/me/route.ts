import { NextResponse } from 'next/server'
import { currentUserId } from '@/lib/identity'

export const dynamic = 'force-dynamic'

// Identidad del usuario logueado (vía la sesión de Google del shell), para que
// el cliente sepa quién es sin selector manual.
export async function GET() {
  return NextResponse.json({ userId: await currentUserId() })
}
