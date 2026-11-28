import { NextRequest, NextResponse } from 'next/server'
import { endViewAs, homeOf, sameOriginPost } from '@/lib/view-as'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!sameOriginPost(req)) {
    return NextResponse.json({ error: 'No se pudo salir. Recargá la página.' }, { status: 403 })
  }
  await endViewAs()
  return NextResponse.redirect(homeOf(req), 303)
}
