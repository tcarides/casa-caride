import NextAuth from 'next-auth'

// Identidad en la zona: lee la sesión JWT del shell (cookie compartida en el
// apex + AUTH_SECRET común). App privada (login requerido); no necesitamos más
// que el email para el gate.
const { auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        ;(session.user as { role?: string }).role = (token.role as string) ?? 'member'
      }
      return session
    },
  },
})

export async function currentEmail(): Promise<string | null> {
  try {
    const session = await auth()
    return session?.user?.email?.toLowerCase() ?? null
  } catch {
    return null
  }
}

export async function currentUser(): Promise<{ email: string; name: string; role: string } | null> {
  try {
    const session = await auth()
    const email = session?.user?.email?.toLowerCase()
    if (!email) return null
    const role = (session?.user as { role?: string } | undefined)?.role ?? 'member'
    return { email, name: session?.user?.name ?? email, role }
  } catch {
    return null
  }
}
