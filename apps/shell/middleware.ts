import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

const { auth } = NextAuth(authConfig)

// Gate de sesión para toda la PWA. Las rutas públicas (login, /api/auth,
// estáticos del DS, assets) quedan excluidas por el matcher de abajo.
export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const role = req.auth?.user?.role

  if (!isLoggedIn) {
    const url = new URL('/login', nextUrl)
    url.searchParams.set('callbackUrl', nextUrl.pathname + nextUrl.search)
    return Response.redirect(url)
  }

  // El módulo de admin es solo para el admin.
  if (nextUrl.pathname.startsWith('/admin') && role !== 'admin') {
    return Response.redirect(new URL('/', nextUrl))
  }
})

export const config = {
  // Corre en todo, menos: API de auth, página de login, assets de Next,
  // tokens del DS, el service worker, manifest e íconos.
  matcher: [
    '/((?!api/auth|login|_next/static|_next/image|ds/|sw\\.js|manifest\\.webmanifest|icon-|apple-touch|favicon).*)',
  ],
}
