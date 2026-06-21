import NextAuth from 'next-auth'

// Gate de la zona: protege el acceso DIRECTO a casa-caride-cuentas-claras.vercel.app.
// En el flujo normal (vía el shell) la cookie de sesión llega reenviada → req.auth
// está presente y pasa. Sin sesión (entrada directa) → al login del shell.
const { auth } = NextAuth({ trustHost: true, session: { strategy: 'jwt' }, providers: [] })

export default auth((req) => {
  if (req.auth) return
  return Response.redirect(new URL('/login', 'https://casa-caride.vercel.app'))
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
