import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { isAppAllowed } from '@/lib/db'
import { APPS } from '@/app/apps.config'

const { auth } = NextAuth(authConfig)

const APP_SLUGS = APPS.map((a) => a.slug)
const ACCESS = new Map(APPS.map((a) => [a.slug, a.access ?? 'permission']))
function appSlug(path: string): string | null {
  const seg = path.split('/')[1]
  return APP_SLUGS.includes(seg) ? seg : null
}

// Acceso por niveles (la home y las apps públicas no requieren login):
//  - public     → libre (deslogueado).
//  - open       → requiere login para usar; logueado, cualquiera.
//  - permission → requiere login + permiso del admin.
export default auth(async (req) => {
  const { nextUrl } = req
  const path = nextUrl.pathname
  const slug = appSlug(path)
  const access = slug ? ACCESS.get(slug) : undefined

  // Libre: home (launcher), apps públicas y la API pública del fixture.
  if (path === '/' || access === 'public' || path.startsWith('/api/fixture')) return

  // De acá en adelante hace falta sesión.
  if (!req.auth) {
    const url = new URL('/login', nextUrl)
    url.searchParams.set('callbackUrl', path + nextUrl.search)
    return Response.redirect(url)
  }

  const role = req.auth.user?.role
  const email = req.auth.user?.email ?? ''

  if (path.startsWith('/admin') && role !== 'admin') {
    return Response.redirect(new URL('/', nextUrl))
  }

  // 'open' lo usa cualquier logueado; 'permission' chequea el permiso (admin = todo).
  if (slug && access === 'permission' && role !== 'admin') {
    const ok = await isAppAllowed(email, slug)
    if (!ok) return Response.redirect(new URL(`/?denied=${slug}`, nextUrl))
  }
})

export const config = {
  matcher: [
    '/((?!api/auth|login|invite|_next/static|_next/image|ds/|sw\\.js|manifest\\.webmanifest|icon-|apple-touch|favicon).*)',
  ],
}
