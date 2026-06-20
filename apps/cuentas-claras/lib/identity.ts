import NextAuth from 'next-auth'

// Identidad en la zona: lee la sesión JWT del shell (cookie compartida en el
// apex + AUTH_SECRET común). v1: la usamos para el dueño de la cuenta. El
// scoping "cada uno ve lo suyo" se enchufa cuando validemos esto en un deploy.
const { auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  providers: [],
})

export async function currentEmail(): Promise<string | null> {
  try {
    const session = await auth()
    return session?.user?.email?.toLowerCase() ?? null
  } catch {
    return null
  }
}
