import type { DefaultSession } from 'next-auth'

// Sumamos rol + userId a la sesión y al JWT.
declare module 'next-auth' {
  interface Session {
    user: {
      role: 'admin' | 'member'
      userId: string | null
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'admin' | 'member'
    userId?: string | null
  }
}
