import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { currentUser, isViewingAs } from '@/lib/identity'
import { findByToken, grantCuentaAccess, grantGrupoAccess } from '@/lib/access'

export const dynamic = 'force-dynamic'

const COOKIE = 'cc_join'

// cc_join=cuentas:<token> o cuentas-grupo:<token>, dejado por una invitación.
// "Ver como" no suma a la persona impersonada.
export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'no autenticado' }, { status: 401 })
  const ref = (await cookies()).get(COOKIE)?.value ?? ''
  const kind = ref.startsWith('cuentas-grupo:') ? 'grupo' : ref.startsWith('cuentas:') ? 'cuenta' : null
  if (!kind) return NextResponse.json({ ok: true })
  if (await isViewingAs()) return NextResponse.json({ ok: true, skipped: true })
  const token = ref.slice(ref.indexOf(':') + 1)
  const found = await findByToken(kind, token)
  if (found) {
    if (kind === 'cuenta') await grantCuentaAccess(found.id, user.email, user.name, 'invitacion')
    else await grantGrupoAccess(found.id, user.email, user.name, 'invitacion')
  }
  const res = NextResponse.json({ ok: true, id: found?.id ?? null })
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
