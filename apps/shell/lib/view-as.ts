import { cookies } from 'next/headers'
import {
  VIEW_AS_COOKIE,
  VIEW_AS_HINT,
  VIEW_AS_TTL_SEC,
  hintValue,
  matchesAdmin,
  openViewAs,
  sealViewAs,
  viewAsCookieOptions,
  type ViewAs,
} from '@casa/view-as'
import { auth } from '@/auth'
import { logImpersonation, type User } from '@/lib/db'

export type SessionUser = {
  email: string
  name: string
  role: 'admin' | 'member'
  userId: string | null
}

export async function getViewer(): Promise<{
  real: SessionUser | null
  effective: SessionUser | null
  viewing: ViewAs | null
}> {
  const session = await auth()
  const real = toSessionUser(session?.user)
  if (!real) return { real: null, effective: null, viewing: null }
  const raw = (await cookies()).get(VIEW_AS_COOKIE)?.value
  const opened = await openViewAs(raw, process.env.AUTH_SECRET)
  const viewing = opened.ok && matchesAdmin(opened.view, real.email, real.role) ? opened.view : null
  if (!viewing) return { real, effective: real, viewing: null }
  return {
    real,
    viewing,
    effective: {
      email: viewing.email,
      name: viewing.name,
      role: viewing.role,
      userId: viewing.userId,
    },
  }
}

export async function beginViewAs(adminEmail: string, target: User): Promise<void> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('Falta AUTH_SECRET')
  const token = await sealViewAs({
    adminEmail,
    email: target.email,
    name: target.name,
    role: target.role,
    userId: target.userId,
  }, secret)
  const jar = await cookies()
  const opts = viewAsCookieOptions(VIEW_AS_TTL_SEC, true)
  jar.set(VIEW_AS_COOKIE, token, opts)
  jar.set(VIEW_AS_HINT, hintValue(target.name), viewAsCookieOptions(VIEW_AS_TTL_SEC, false))
  try {
    await logImpersonation(adminEmail, target.email, 'start')
  } catch (err) {
    clearJar(jar)
    throw err
  }
}

/** Cierra la vista y deja asentado el stop si la cookie era auténtica. */
export async function endViewAs(): Promise<void> {
  const jar = await cookies()
  const raw = jar.get(VIEW_AS_COOKIE)?.value
  const opened = await openViewAs(raw, process.env.AUTH_SECRET)
  if (opened.view && (opened.ok || opened.reason === 'expired')) {
    try {
      await logImpersonation(opened.view.adminEmail, opened.view.email, 'stop')
    } catch { /* salir igual */ }
  }
  clearJar(jar)
}

export function homeOf(req: Request): URL {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '') || 'https'
  if (!host) return new URL('/', req.url)
  return new URL('/', `${proto}://${host}`)
}

export function sameOriginPost(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site')
  // El navegador manda same-origin en el form de Salir. No comparamos contra
  // req.url: en dev el host puede ser 127.0.0.1 y Next arma la URL con localhost.
  if (site === 'same-origin' || site === 'same-site' || site === 'none') return true
  if (site === 'cross-site') return false
  const origin = req.headers.get('origin')
  if (!origin) return true
  const host = req.headers.get('host')
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function clearJar(jar: Awaited<ReturnType<typeof cookies>>) {
  jar.set(VIEW_AS_COOKIE, '', viewAsCookieOptions(0, true))
  jar.set(VIEW_AS_HINT, '', viewAsCookieOptions(0, false))
}

function toSessionUser(user: {
  email?: string | null
  name?: string | null
  role?: string | null
  userId?: string | null
} | undefined): SessionUser | null {
  const email = user?.email?.toLowerCase()
  if (!email || !user) return null
  return {
    email,
    name: user.name ?? email,
    role: user.role === 'admin' ? 'admin' : 'member',
    userId: user.userId ?? null,
  }
}
