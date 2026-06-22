import NextAuth from 'next-auth'

// Lee la sesión JWT del shell (cookie reenviada por el rewrite + AUTH_SECRET común).
// El callback de sesión expone `userId` (lo guarda el shell en el token al loguear:
// 'tomi' | 'flori' | …) para derivar la identidad sin selector manual.
const { auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        ;(session.user as { userId?: string | null }).userId =
          (token.userId as string | null) ?? null
      }
      return session
    },
  },
})

export async function currentUser(): Promise<{ email: string; name: string } | null> {
  try {
    const s = await auth()
    const email = s?.user?.email?.toLowerCase()
    return email ? { email, name: s?.user?.name ?? email } : null
  } catch {
    return null
  }
}

/** Identidad de la app ('tomi' | 'flori') derivada de la sesión de Google. */
export async function currentUserId(): Promise<'tomi' | 'flori' | null> {
  try {
    const s = await auth()
    const uid = (s?.user as { userId?: string | null } | undefined)?.userId
    return uid === 'tomi' || uid === 'flori' ? uid : null
  } catch {
    return null
  }
}
