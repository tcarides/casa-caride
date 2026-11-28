import { NextRequest, NextResponse } from 'next/server'
import { VIEW_AS_COOKIE, viewAsWriteBlock } from '@casa/view-as'

// Gate de zona (defensa para acceso directo a la URL del proyecto). Chequea la
// PRESENCIA de la cookie de sesión, sin decodificar (evita el wrapper de
// Auth.js, que con basePath no corre bien en el middleware). En el flujo normal
// la cookie llega reenviada por el shell → pasa. Directo (sin cookie):
//  - /api/* → 401 (no exponemos datos a llamadas sin sesión).
//  - resto  → redirect al shell (que pide login o reenvía la cookie).
const CANONICAL = 'https://casa-caride.vercel.app/navidad'

export async function middleware(req: NextRequest) {
  // Escrituras frenadas si la cookie de "ver como" viajó con el rewrite.
  // El shell ya las corta; esto cubre el caso de que el POST llegue igual.
  const blocked = await viewAsWriteBlock({
    method: req.method,
    pathname: req.nextUrl.pathname,
    cookie: req.cookies.get(VIEW_AS_COOKIE)?.value,
    secret: process.env.AUTH_SECRET,
    header: (name) => req.headers.get(name),
  })
  if (blocked) return NextResponse.json(blocked, { status: 403 })

  // Rutas públicas (sin login): vista de solo lectura y API pública de validación.
  if (/\/ver\//.test(req.nextUrl.pathname) || /\/api\/public\//.test(req.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const hasSession =
    req.cookies.has('__Secure-authjs.session-token') ||
    req.cookies.has('authjs.session-token')
  if (hasSession) return NextResponse.next()
  if (/(^|\/)api\//.test(req.nextUrl.pathname)) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 })
  }
  return NextResponse.redirect(new URL(CANONICAL))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
