import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { currentUser, isViewingAs } from '@/lib/identity'
import { findGrupoIdByToken, grantGrupoAccess } from '@/lib/access'

export const dynamic = 'force-dynamic'

const COOKIE = 'cc_join'

// Después de aceptar una invitación, el shell deja cc_join=navidad:<token>.
// Al abrir Regalos, esta persona queda en esa lista. "Ver como" no suma a nadie.
export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'no autenticado' }, { status: 401 })
  const jar = await cookies()
  const ref = jar.get(COOKIE)?.value ?? ''
  if (!ref.startsWith('navidad:')) return NextResponse.json({ ok: true })
  if (await isViewingAs()) return NextResponse.json({ ok: true, skipped: true })
  const token = ref.slice('navidad:'.length)
  const grupo = await findGrupoIdByToken(token)
  if (grupo) await grantGrupoAccess(grupo.id, user.email, user.name, 'invitacion')
  const res = NextResponse.json({ ok: true, id: grupo?.id ?? null })
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
