import { randomBytes } from 'crypto'
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { APPS } from '@/app/apps.config'

// Base de datos del shell: usuarios (allowlist), acceso por app e invitaciones.
// La sesión es JWT (no usamos esta DB para la sesión, solo para autorización).

type Sql = NeonQueryFunction<false, false>
let _sql: Sql | undefined

export function getSql(): Sql {
  if (_sql) return _sql
  const conn =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL
  if (!conn) throw new Error('Falta DATABASE_URL (Neon del shell).')
  _sql = neon(conn)
  return _sql
}

export type Role = 'admin' | 'member'
export interface User {
  email: string
  name: string
  role: Role
  userId: string | null // 'tomi' | 'flori' | … para mapear identidad en las apps
}

// Usuarios iniciales: el admin y Flori. El resto entra por invitación.
const SEED_USERS: User[] = [
  { email: 'tomascaride@gmail.com', name: 'Tomás', role: 'admin', userId: 'tomi' },
  { email: 'florencia.pastorini@gmail.com', name: 'Flori', role: 'member', userId: 'flori' },
]

let schemaReady = false

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return
  const sql = getSql()

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      email      TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'member',
      user_id    TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS app_access (
      email   TEXT NOT NULL,
      app_key TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (email, app_key)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS invites (
      token       TEXT PRIMARY KEY,
      note        TEXT,
      apps_preset TEXT NOT NULL DEFAULT '',
      created_by  TEXT,
      expires_at  TIMESTAMPTZ,
      used_by     TEXT,
      used_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  // Multi-uso: max_usos = 1 (una persona) · 0 (ilimitado) · N (hasta N). usos = contador.
  await sql`ALTER TABLE invites ADD COLUMN IF NOT EXISTS max_usos INTEGER NOT NULL DEFAULT 1`
  await sql`ALTER TABLE invites ADD COLUMN IF NOT EXISTS usos INTEGER NOT NULL DEFAULT 0`

  // Seed idempotente de usuarios iniciales.
  for (const u of SEED_USERS) {
    await sql`
      INSERT INTO users (email, name, role, user_id)
      VALUES (${u.email}, ${u.name}, ${u.role}, ${u.userId})
      ON CONFLICT (email) DO NOTHING
    `
  }
  // Flori arranca con todas las apps habilitadas (el admin no necesita filas).
  for (const app of APPS) {
    await sql`
      INSERT INTO app_access (email, app_key, enabled)
      VALUES (${'florencia.pastorini@gmail.com'}, ${app.slug}, TRUE)
      ON CONFLICT (email, app_key) DO NOTHING
    `
  }

  schemaReady = true
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    email: r.email as string,
    name: r.name as string,
    role: (r.role as Role) ?? 'member',
    userId: (r.user_id as string | null) ?? null,
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT email, name, role, user_id FROM users WHERE email = ${email.toLowerCase()}`
  return rows.length ? rowToUser(rows[0]) : null
}

export async function listUsers(): Promise<User[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT email, name, role, user_id FROM users ORDER BY role DESC, name ASC`
  return rows.map(rowToUser)
}

/** Apps habilitadas para un email (solo members; el admin accede a todo). */
export async function getEnabledApps(email: string): Promise<string[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT app_key FROM app_access WHERE email = ${email.toLowerCase()} AND enabled = TRUE`
  return rows.map((r) => r.app_key as string)
}

export async function setAppAccess(email: string, appKey: string, enabled: boolean): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    INSERT INTO app_access (email, app_key, enabled)
    VALUES (${email.toLowerCase()}, ${appKey}, ${enabled})
    ON CONFLICT (email, app_key) DO UPDATE SET enabled = ${enabled}
  `
}

/** Mapa email → apps habilitadas (para la grilla del admin). */
export async function getAllAccess(): Promise<Record<string, string[]>> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT email, app_key FROM app_access WHERE enabled = TRUE`
  const map: Record<string, string[]> = {}
  for (const r of rows) {
    const e = r.email as string
    ;(map[e] ??= []).push(r.app_key as string)
  }
  return map
}

export async function addUser(
  email: string, name: string, role: Role, userId: string | null = null,
): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    INSERT INTO users (email, name, role, user_id)
    VALUES (${email.toLowerCase()}, ${name}, ${role}, ${userId})
    ON CONFLICT (email) DO UPDATE SET name = ${name}, role = ${role}
  `
}

export async function deleteUser(email: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  const e = email.toLowerCase()
  await sql`DELETE FROM app_access WHERE email = ${e}`
  await sql`DELETE FROM users WHERE email = ${e}`
}

/**
 * ¿Puede este email usar esta app? Consulta directa (sin ensureSchema) pensada
 * para el middleware: para cuando se invoca, el esquema ya existe (el login lo
 * crea). El admin se resuelve antes, sin tocar la DB.
 */
export async function isAppAllowed(email: string, appKey: string): Promise<boolean> {
  const sql = getSql()
  const rows = await sql`
    SELECT enabled FROM app_access
    WHERE email = ${email.toLowerCase()} AND app_key = ${appKey}
  `
  return rows.length > 0 && rows[0].enabled === true
}

// ── Invitaciones ──
export interface Invite {
  token: string
  note: string
  apps: string[]
}

export async function createInvite(
  note: string, apps: string[], createdBy: string, maxUsos = 1, days = 7,
): Promise<string> {
  await ensureSchema()
  const sql = getSql()
  const token = randomBytes(16).toString('base64url')
  const expires = new Date(Date.now() + days * 86_400_000).toISOString()
  await sql`
    INSERT INTO invites (token, note, apps_preset, created_by, expires_at, max_usos)
    VALUES (${token}, ${note}, ${apps.join(',')}, ${createdBy}, ${expires}, ${maxUsos})
  `
  return token
}

// ¿Sigue usable? max_usos: 1 = una persona (válido si no se usó) · 0 = ilimitado ·
// N>1 = hasta N usos.
function inviteUsable(r: Record<string, unknown>): boolean {
  if (r.expires_at && new Date(r.expires_at as string) < new Date()) return false
  const max = Number(r.max_usos ?? 1)
  const usos = Number(r.usos ?? 0)
  if (max === 1) return !r.used_by
  if (max === 0) return true
  return usos < max
}

/** Invitación válida (no vencida y con usos disponibles) o null. */
export async function getValidInvite(token: string): Promise<Invite | null> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT note, apps_preset, used_by, expires_at, max_usos, usos FROM invites WHERE token = ${token}`
  if (!rows.length) return null
  const r = rows[0]
  if (!inviteUsable(r)) return null
  const preset = (r.apps_preset as string) || ''
  return { token, note: (r.note as string) ?? '', apps: preset ? preset.split(',') : [] }
}

/** Crea el usuario (member) con las apps del preset y registra el uso de la invitación. */
export async function consumeInvite(
  token: string, email: string, name: string, apps: string[],
): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  const e = email.toLowerCase()
  await sql`
    INSERT INTO users (email, name, role) VALUES (${e}, ${name}, 'member')
    ON CONFLICT (email) DO NOTHING
  `
  for (const app of apps) {
    await sql`
      INSERT INTO app_access (email, app_key, enabled) VALUES (${e}, ${app}, TRUE)
      ON CONFLICT (email, app_key) DO UPDATE SET enabled = TRUE
    `
  }
  // Cuenta el uso; en single-use además marca used_by (registro del que entró).
  await sql`UPDATE invites SET usos = usos + 1, used_at = NOW(), used_by = COALESCE(used_by, ${e}) WHERE token = ${token}`
}

export interface PendingInvite {
  token: string; note: string; apps: string[]; expiresAt: string | null
  maxUsos: number; usos: number
}
export async function listPendingInvites(): Promise<PendingInvite[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT token, note, apps_preset, expires_at, max_usos, usos FROM invites
    WHERE (expires_at IS NULL OR expires_at > NOW())
      AND (max_usos = 0 OR (max_usos = 1 AND used_by IS NULL) OR (max_usos > 1 AND usos < max_usos))
    ORDER BY created_at DESC
  `
  return rows.map((r) => ({
    token: r.token as string,
    note: (r.note as string) ?? '',
    apps: ((r.apps_preset as string) || '') ? (r.apps_preset as string).split(',') : [],
    expiresAt: (r.expires_at as string) ?? null,
    maxUsos: Number(r.max_usos ?? 1),
    usos: Number(r.usos ?? 0),
  }))
}

export async function deleteInvite(token: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM invites WHERE token = ${token}`
}
