import { NextRequest, NextResponse } from 'next/server'

// Gate de zona (defensa para acceso directo a la URL del proyecto). Chequea la
// PRESENCIA de la cookie de sesión, sin decodificar (evita el wrapper de
// Auth.js, que con basePath no corre bien en el middleware). En el flujo normal
// la cookie llega reenviada por el shell → pasa. Directo (sin cookie):
//  - /api/* → 401 (no exponemos datos a llamadas sin sesión).
//  - resto  → redirect al shell (que pide login o reenvía la cookie).
const CANONICAL = 'https://casa-caride.vercel.app/super'

export function middleware(req: NextRequest) {
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
