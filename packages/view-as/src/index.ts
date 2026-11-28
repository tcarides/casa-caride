// "Ver como": cookie firmada para que un admin mire la casa con la identidad
// de otra persona, sin tocar el JWT de Auth.js (la sesión real sigue siendo
// la del admin). La firman y la leen el shell y las zonas con el mismo
// AUTH_SECRET. Expira a la hora.

export const VIEW_AS_COOKIE = 'cc_view_as'
export const VIEW_AS_HINT = 'cc_viewing'
export const VIEW_AS_TTL_SEC = 60 * 60
export const VIEW_AS_CODE = 'view_as_readonly'

const WRITE_ALLOW = new Set(['/api/view-as/stop', '/api/session/logout'])

export type Role = 'admin' | 'member'

export type ViewAs = {
  adminEmail: string
  email: string
  name: string
  role: Role
  userId: string | null
  exp: number
}

export type Viewer = {
  email: string
  name: string
  role: string
  userId: string | null
}

export type OpenResult =
  | { ok: true; view: ViewAs }
  | { ok: false; reason: 'missing' | 'bad' | 'expired'; view: ViewAs | null }

export type ReadonlyBody = { error: string; code: typeof VIEW_AS_CODE }

type HeaderFn = (name: string) => string | null

export function readonlyMessage(name: string): string {
  const who = name.trim() || 'otra persona'
  return `Estás viendo como ${who}. No podés crear, editar ni borrar nada.`
}

export function readonlyBody(name: string): ReadonlyBody {
  return { error: readonlyMessage(name), code: VIEW_AS_CODE }
}

export function hintValue(name: string): string {
  return name.replace(/[\r\n;]/g, ' ').trim().slice(0, 80) || 'otra persona'
}

export function viewAsCookieOptions(maxAge: number, httpOnly: boolean) {
  return {
    httpOnly,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

export function matchesAdmin(
  view: ViewAs,
  email: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (!email || role !== 'admin') return false
  return view.adminEmail === email.toLowerCase()
}

export async function overlayViewer(
  real: Viewer,
  cookie: string | undefined,
  secret: string | undefined,
): Promise<Viewer> {
  if (real.role !== 'admin' || !secret || !cookie) return real
  const opened = await openViewAs(cookie, secret)
  if (!opened.ok || !matchesAdmin(opened.view, real.email, real.role)) return real
  return {
    email: opened.view.email,
    name: opened.view.name,
    role: opened.view.role,
    userId: opened.view.userId,
  }
}

export async function sealViewAs(
  input: Omit<ViewAs, 'exp'> & { exp?: number },
  secret: string,
): Promise<string> {
  if (!secret) throw new Error('Falta AUTH_SECRET')
  const view: ViewAs = {
    adminEmail: input.adminEmail.toLowerCase(),
    email: input.email.toLowerCase(),
    name: input.name,
    role: input.role,
    userId: input.userId,
    exp: input.exp ?? Date.now() + VIEW_AS_TTL_SEC * 1000,
  }
  const body = b64urlEncodeString(JSON.stringify(view))
  const sig = await sign(secret, body)
  return `${body}.${sig}`
}

export async function openViewAs(token: string | undefined, secret: string | undefined): Promise<OpenResult> {
  if (!token) return { ok: false, reason: 'missing', view: null }
  if (!secret) return { ok: false, reason: 'bad', view: null }
  const dot = token.indexOf('.')
  if (dot <= 0 || dot !== token.lastIndexOf('.')) return { ok: false, reason: 'bad', view: null }
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = await sign(secret, body)
  if (!safeEqual(sig, expected)) return { ok: false, reason: 'bad', view: null }
  const view = parseView(body)
  if (!view) return { ok: false, reason: 'bad', view: null }
  if (view.exp <= Date.now()) return { ok: false, reason: 'expired', view }
  return { ok: true, view }
}

export function shouldBlockWrite(method: string, pathname: string, header: HeaderFn): boolean {
  const verb = method.toUpperCase()
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return false
  const path = normalizePath(pathname)
  if (WRITE_ALLOW.has(path)) return false
  // Navegación del App Router (RSC). Una server action trae Next-Action y sí es escritura.
  if (header('rsc') === '1' && !header('next-action')) return false
  return true
}

export async function viewAsWriteBlock(input: {
  method: string
  pathname: string
  cookie: string | undefined
  secret: string | undefined
  header: HeaderFn
}): Promise<ReadonlyBody | null> {
  if (!shouldBlockWrite(input.method, input.pathname, input.header)) return null
  if (!input.cookie) return null
  // Sin secreto no podemos verificar: si la cookie está, frenamos igual.
  // El shell (que sí tiene AUTH_SECRET) es el que la emite.
  if (!input.secret) return readonlyBody('otra persona')
  const opened = await openViewAs(input.cookie, input.secret)
  if (!opened.ok) return null
  return readonlyBody(opened.view.name)
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

function parseView(body: string): ViewAs | null {
  try {
    const json = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as Record<string, unknown>
    if (!json || typeof json !== 'object') return null
    if (typeof json.adminEmail !== 'string' || !json.adminEmail.includes('@')) return null
    if (typeof json.email !== 'string' || !json.email.includes('@')) return null
    if (typeof json.name !== 'string' || !json.name.trim()) return null
    if (json.role !== 'admin' && json.role !== 'member') return null
    if (!(json.userId === null || typeof json.userId === 'string')) return null
    if (typeof json.exp !== 'number' || !Number.isFinite(json.exp)) return null
    return {
      adminEmail: json.adminEmail.toLowerCase(),
      email: json.email.toLowerCase(),
      name: json.name,
      role: json.role,
      userId: json.userId,
      exp: json.exp,
    }
  } catch {
    return null
  }
}

async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return b64urlEncode(new Uint8Array(sig))
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function b64urlEncodeString(value: string): string {
  return b64urlEncode(new TextEncoder().encode(value))
}

function b64urlDecode(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
