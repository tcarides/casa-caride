import NextAuth from 'next-auth'
import { cookies } from 'next/headers'
import { authConfig } from './auth.config'
import { getUserByEmail, getValidInvite, consumeInvite } from '@/lib/db'

export const INVITE_COOKIE = 'cc_invite'

// Config completa (runtime Node): suma las callbacks que consultan la DB.
// La usan el route handler de /api/auth y los Server Components/Actions.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Allowlist: entra quien ya está en users, o quien trae una invitación
    // válida (se auto-registra como member con las apps del preset).
    async signIn({ user }) {
      const email = user.email?.toLowerCase()
      if (!email) return false
      if (await getUserByEmail(email)) return true

      const token = (await cookies()).get(INVITE_COOKIE)?.value
      if (token) {
        const inv = await getValidInvite(token)
        if (inv) {
          await consumeInvite(token, email, user.name ?? inv.note ?? email, inv.apps)
          return true
        }
      }
      return '/login?error=not-allowed'
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
