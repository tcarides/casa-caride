import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { isAppAllowed, logImpersonation } from '@/lib/db'
import { APPS } from '@/app/apps.config'
import {
  VIEW_AS_COOKIE,
  VIEW_AS_HINT,
  matchesAdmin,
  openViewAs,
  readonlyBody,
  shouldBlockWrite,
  viewAsCookieOptions,
  type ViewAs,
} from '@casa/view-as'

const { auth } = NextAuth(authConfig)

const APP_SLUGS = APPS.map((a) => a.slug)
const ACCESS = new Map(APPS.map((a) => [a.slug, a.access ?? 'permission']))
function appSlug(path: string): string | null {
  const seg = path.split('/')[1]
  return APP_SLUGS.includes(seg) ? seg : null
}

function clearViewAs(res: NextResponse) {
  res.cookies.set(VIEW_AS_COOKIE, '', viewAsCookieOptions(0, true))
  res.cookies.set(VIEW_AS_HINT, '', viewAsCookieOptions(0, false))
  return res
}

// Acceso por niveles (la home y las apps públicas no requieren login):
//  - public     → libre (deslogueado).
//  - open       → requiere login para usar; logueado, cualquiera.
//  - permission → requiere login + permiso del admin.
// Si hay una cookie de "ver como" válida, el rol y el email efectivos son
// los de esa persona (el JWT del admin no se toca). Las escrituras se frenan
// acá, antes del rewrite a la zona.
export default auth(async (req) => {
  const { nextUrl } = req
  const path = nextUrl.pathname
  const slug = appSlug(path)
  const access = slug ? ACCESS.get(slug) : undefined

  const raw = req.cookies.get(VIEW_AS_COOKIE)?.value
  const opened = await openViewAs(raw, process.env.AUTH_SECRET)
  const sessionEmail = req.auth?.user?.email ?? null
  const sessionRole = req.auth?.user?.role ?? null

  let viewing: ViewAs | null = null
  let clear = false
  if (opened.ok && matchesAdmin(opened.view, sessionEmail, sessionRole)) {
    viewing = opened.view
  } else if (raw) {
    clear = true
    if (opened.view && (opened.ok || opened.reason === 'expired')) {
      try { await logImpersonation(opened.view.adminEmail, opened.view.email, 'stop') } catch { /* seguir */ }
    }
  }

  if (viewing && shouldBlockWrite(req.method, path, (name) => req.headers.get(name))) {
    return NextResponse.json(readonlyBody(viewing.name), { status: 403 })
  }

  const role = viewing ? viewing.role : sessionRole
  const email = (viewing ? viewing.email : sessionEmail ?? '').toLowerCase()

  const done = (res?: NextResponse) => {
    if (!res && !clear) return
    const out = res ?? NextResponse.next()
    return clear ? clearViewAs(out) : out
  }

  // Libre: home (launcher), apps públicas y la API pública del fixture.
  if (path === '/' || access === 'public' || path.startsWith('/api/fixture')) return done()

  // Libre: vista pública de solo lectura de Navidad (link para compartir) y sus
  // assets estáticos (para que la página se vea sin login).
  if (path.startsWith('/navidad/ver/') || path.startsWith('/navidad/_next/')) return done()

  // Libre: "unirse" convierte el link de una lista en invitación (valida el
  // token y manda a /invite). Va antes del gate de login.
  if (path.startsWith('/unirse/')) return done()

  // De acá en adelante hace falta sesión.
  if (!req.auth) {
    const url = new URL('/login', nextUrl)
    url.searchParams.set('callbackUrl', path + nextUrl.search)
    return done(NextResponse.redirect(url))
  }

  if (path.startsWith('/admin') && role !== 'admin') {
    return done(NextResponse.redirect(new URL('/', nextUrl)))
  }

  // 'open' lo usa cualquier logueado; 'permission' chequea el permiso (admin = todo).
  if (slug && access === 'permission' && role !== 'admin') {
    const ok = await isAppAllowed(email, slug)
    if (!ok) return done(NextResponse.redirect(new URL(`/?denied=${slug}`, nextUrl)))
  }

  return done()
})

export const config = {
  // matcher: home, apps públicas y resto de rutas (excluye auth, login, assets).
  matcher: [
    '/((?!api/auth|login|invite|_next/static|_next/image|ds/|sw\\.js|view-as\\.js|manifest\\.webmanifest|icon-|apple-touch|favicon).*)',
  ],
}
