import NextAuth from 'next-auth'

// Lee la sesión JWT del shell (cookie reenviada por el rewrite + AUTH_SECRET común).
const { auth } = NextAuth({ trustHost: true, session: { strategy: 'jwt' }, providers: [] })

export async function currentUser(): Promise<{ email: string; name: string } | null> {
  try {
    const s = await auth()
    const email = s?.user?.email?.toLowerCase()
    return email ? { email, name: s?.user?.name ?? email } : null
  } catch {
    return null
  }
}
