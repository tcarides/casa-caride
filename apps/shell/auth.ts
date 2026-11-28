import NextAuth from 'next-auth'
import { cookies } from 'next/headers'
import { authConfig } from './auth.config'
import { getUserByEmail, getValidInvite, consumeInvite } from '@/lib/db'

export const INVITE_COOKIE = 'cc_invite'
export const JOIN_COOKIE = 'cc_join'

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

      const jar = await cookies()
      const token = jar.get(INVITE_COOKIE)?.value
      const inv = token ? await getValidInvite(token) : null
      if (inv?.joinRef) {
        jar.set(JOIN_COOKIE, inv.joinRef, { httpOnly: true, sameSite: 'lax', maxAge: 3600, path: '/' })
      }

      if (await getUserByEmail(email)) return true
      if (inv) {
        await consumeInvite(token!, email, user.name ?? inv.note ?? email, inv.apps)
        return true
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
