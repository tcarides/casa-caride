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
      apps_preset TEXT[] NOT NULL DEFAULT '{}',
      created_by  TEXT,
      expires_at  TIMESTAMPTZ,
      used_by     TEXT,
      used_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

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
