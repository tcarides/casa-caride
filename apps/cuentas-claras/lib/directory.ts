const SHELL = (process.env.SHELL_URL || process.env.AUTH_URL || 'https://casa-caride.vercel.app').replace(/\/$/, '')

export interface DirUser { email: string; name: string }
export interface DirUserRole extends DirUser { role: string }
export interface JoinHint {
  app: string
  email: string
  token: string | null
  nombre: string | null
}

export async function fetchDirectory(cookie: string): Promise<DirUser[] | null> {
  if (!cookie) return null
  try {
    const r = await fetch(`${SHELL}/api/directory`, { headers: { cookie }, cache: 'no-store' })
    if (!r.ok) return null
    const data = (await r.json()) as { email?: string; name?: string }[]
    if (!Array.isArray(data)) return null
    return data.flatMap((u) => (u.email && u.name ? [{ email: u.email, name: u.name }] : []))
  } catch {
    return null
  }
}

export async function fetchJoinHints(cookie: string): Promise<{ users: DirUserRole[]; hints: JoinHint[] } | null> {
  if (!cookie) return null
  try {
    const r = await fetch(`${SHELL}/api/join-hints`, { headers: { cookie }, cache: 'no-store' })
    if (!r.ok) return null
    const data = (await r.json()) as { users?: DirUserRole[]; hints?: JoinHint[] }
    if (!Array.isArray(data.users) || !Array.isArray(data.hints)) return null
    return { users: data.users, hints: data.hints }
  } catch {
    return null
  }
}
