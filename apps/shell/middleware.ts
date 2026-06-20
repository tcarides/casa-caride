import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { isAppAllowed } from '@/lib/db'
import { APPS } from '@/app/apps.config'

const { auth } = NextAuth(authConfig)

const APP_SLUGS = APPS.map((a) => a.slug)
// Apps abiertas a cualquier usuario logueado (sin permiso por-usuario).
const OPEN_TO_ALL = new Set(APPS.filter((a) => a.openToAll).map((a) => a.slug))
function appSlug(path: string): string | null {
  const seg = path.split('/')[1]
  return APP_SLUGS.includes(seg) ? seg : null
}

// Gate de sesión + autorización por app para toda la PWA.
export default auth(async (req) => {
  const { nextUrl } = req

  if (!req.auth) {
    const url = new URL('/login', nextUrl)
    url.searchParams.set('callbackUrl', nextUrl.pathname + nextUrl.search)
    return Response.redirect(url)
  }

  const role = req.auth.user?.role
  const email = req.auth.user?.email ?? ''

  // El módulo de admin es solo para el admin.
  if (nextUrl.pathname.startsWith('/admin') && role !== 'admin') {
    return Response.redirect(new URL('/', nextUrl))
  }

  // Autorización por app: el admin accede a todo; los members, solo a lo
  // habilitado. Los cambios del admin aplican al instante (se consulta la DB).
  const slug = appSlug(nextUrl.pathname)
  if (slug && role !== 'admin' && !OPEN_TO_ALL.has(slug)) {
    const ok = await isAppAllowed(email, slug)
    if (!ok) return Response.redirect(new URL(`/?denied=${slug}`, nextUrl))
  }
})

export const config = {
  matcher: [
    '/((?!api/auth|login|invite|_next/static|_next/image|ds/|sw\\.js|manifest\\.webmanifest|icon-|apple-touch|favicon).*)',
  ],
}
