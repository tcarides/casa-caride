import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'

// Config "edge-safe" (sin acceso a la DB): la usa el middleware y la base de
// la config completa en auth.ts. Las callbacks que tocan la DB van en auth.ts.
export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [Google],
  callbacks: {
    // Expone el rol (guardado en el token al loguear) en la sesión, para que
    // el middleware y la UI lo puedan leer sin tocar la DB.
    session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as 'admin' | 'member') ?? 'member'
        session.user.userId = (token.userId as string | null) ?? null
      }
      return session
    },
  },
} satisfies NextAuthConfig
