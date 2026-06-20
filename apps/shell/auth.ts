import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { getUserByEmail } from '@/lib/db'

// Config completa (runtime Node): suma las callbacks que consultan la DB.
// La usan el route handler de /api/auth y los Server Components/Actions.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Allowlist: solo entra quien está en la tabla users.
    async signIn({ user }) {
      const email = user.email?.toLowerCase()
      if (!email) return false
      const u = await getUserByEmail(email)
      return u ? true : '/login?error=not-allowed'
    },
    // Al loguear, guardamos rol + userId en el token (no se re-consulta en cada request).
    async jwt({ token, user }) {
      if (user?.email) {
        const u = await getUserByEmail(user.email.toLowerCase())
        token.role = u?.role ?? 'member'
        token.userId = u?.userId ?? null
      }
      return token
    },
  },
})
