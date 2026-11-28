import NextAuth from 'next-auth'
import { cookies } from 'next/headers'
import { VIEW_AS_COOKIE, overlayViewer, type Viewer } from './index'

// Identidad de zona: lee el JWT del shell y, si hay una cookie de "ver como"
// válida del mismo admin, devuelve a la persona impersonada.

export function createZoneIdentity() {
  const { auth } = NextAuth({
    trustHost: true,
    session: { strategy: 'jwt' },
    providers: [],
    callbacks: {
      session({ session, token }) {
        if (session.user) {
          const t = token as { role?: string; userId?: string | null }
          const u = session.user as unknown as { role?: string; userId?: string | null }
          u.role = t.role ?? 'member'
          u.userId = t.userId ?? null
        }
        return session
      },
    },
  })

  async function realViewer(): Promise<Viewer | null> {
    try {
      const s = await auth()
      const email = s?.user?.email?.toLowerCase()
      if (!email || !s?.user) return null
      const u = s.user as unknown as { role?: string; userId?: string | null }
      return {
        email,
        name: s.user.name ?? email,
        role: u.role ?? 'member',
        userId: u.userId ?? null,
      }
    } catch {
      return null
    }
  }

  async function currentViewer(): Promise<Viewer | null> {
    const real = await realViewer()
    if (!real) return null
    try {
      const raw = (await cookies()).get(VIEW_AS_COOKIE)?.value
      return await overlayViewer(real, raw, process.env.AUTH_SECRET)
    } catch {
      return real
    }
  }

  async function isViewingAs(): Promise<boolean> {
    const real = await realViewer()
    if (!real) return false
    const eff = await currentViewer()
    return !!eff && eff.email !== real.email
  }

  return { currentViewer, isViewingAs }
}
