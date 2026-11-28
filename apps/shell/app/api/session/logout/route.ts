import { NextRequest, NextResponse } from 'next/server'
import { signOut } from '@/auth'
import { endViewAs, homeOf, sameOriginPost } from '@/lib/view-as'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!sameOriginPost(req)) {
    return NextResponse.json({ error: 'No se pudo cerrar la sesión.' }, { status: 403 })
  }
  await endViewAs()
  const home = homeOf(req)
  await signOut({ redirectTo: home.pathname })
  return NextResponse.redirect(home, 303)
}
