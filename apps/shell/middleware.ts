import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { isAppAllowed } from '@/lib/db'

const { auth } = NextAuth(authConfig)

// Slugs de mini-apps que se gatean por permiso (coinciden con apps.config).
const APP_SLUGS = ['super', 'casas', 'olivia', 'fabian', 'fixture']
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
  if (slug && role !== 'admin') {
    const ok = await isAppAllowed(email, slug)
    if (!ok) return Response.redirect(new URL(`/?denied=${slug}`, nextUrl))
  }
})

export const config = {
  matcher: [
    '/((?!api/auth|login|_next/static|_next/image|ds/|sw\\.js|manifest\\.webmanifest|icon-|apple-touch|favicon).*)',
  ],
}
