import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let _sql: NeonQueryFunction<false, false> | null = null

function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL
  if (!url) throw new Error('Falta DATABASE_URL / POSTGRES_URL')
  _sql = neon(url)
  return _sql
}

let schemaReady = false
async function ensureSchema() {
  if (schemaReady) return
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS fabian_doses (
      dose_date DATE        NOT NULL,
      slot      TEXT        NOT NULL CHECK (slot IN ('am', 'pm')),
      given_by  TEXT        NOT NULL,
      given_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (dose_date, slot)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS fabian_push_subs (
      endpoint   TEXT        PRIMARY KEY,
      auth       TEXT        NOT NULL,
      p256dh     TEXT        NOT NULL,
      user_id    TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  schemaReady = true
}

/* ── Push subscriptions ─────────────────────────────────────────────────── */

export interface PushSub {
  endpoint: string
  auth: string
  p256dh: string
  userId: string
}

export async function saveSub(
  sub: { endpoint: string; keys?: { auth?: string; p256dh?: string } },
  userId: string,
): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  const auth   = sub.keys?.auth   ?? ''
  const p256dh = sub.keys?.p256dh ?? ''
  await sql`
    INSERT INTO fabian_push_subs (endpoint, auth, p256dh, user_id)
    VALUES (${sub.endpoint}, ${auth}, ${p256dh}, ${userId})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = ${userId}, created_at = NOW()
  `
}

export async function deleteSub(endpoint: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM fabian_push_subs WHERE endpoint = ${endpoint}`
}

export async function getAllSubs(): Promise<PushSub[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT endpoint, auth, p256dh, user_id FROM fabian_push_subs` as {
    endpoint: string; auth: string; p256dh: string; user_id: string
  }[]
  return rows.map(r => ({ endpoint: r.endpoint, auth: r.auth, p256dh: r.p256dh, userId: r.user_id }))
}

/* ── Doses ──────────────────────────────────────────────────────────────── */

export type Slot = 'am' | 'pm'
export type Caretaker = 'tomi' | 'flori'

export interface Dose {
  date: string      // YYYY-MM-DD
  slot: Slot
  givenBy: Caretaker
  givenAt: string   // ISO
}

interface Row {
  date: string
  slot: Slot
  given_by: Caretaker
  given_at: string | Date
}

function toDto(r: Row): Dose {
  return { date: r.date, slot: r.slot, givenBy: r.given_by, givenAt: new Date(r.given_at).toISOString() }
}

export async function getDoses(from: string, to: string): Promise<Dose[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT to_char(dose_date, 'YYYY-MM-DD') AS date, slot, given_by, given_at
    FROM   fabian_doses
    WHERE  dose_date BETWEEN ${from}::date AND ${to}::date
    ORDER  BY dose_date DESC, slot ASC
  ` as Row[]
  return rows.map(toDto)
}

/**
 * Marca (given=true) o desmarca (given=false) una dosis.
 * Al marcar usa ON CONFLICT DO NOTHING: si ya la marcó el otro, no se pisa.
 * Devuelve la dosis resultante, o null si quedó desmarcada.
 */
export async function setDose(
  date: string,
  slot: Slot,
  user: Caretaker,
  given: boolean,
): Promise<Dose | null> {
  await ensureSchema()
  const sql = getSql()

  if (!given) {
    await sql`DELETE FROM fabian_doses WHERE dose_date = ${date}::date AND slot = ${slot}`
    return null
  }

  await sql`
    INSERT INTO fabian_doses (dose_date, slot, given_by)
    VALUES (${date}::date, ${slot}, ${user})
    ON CONFLICT (dose_date, slot) DO NOTHING
  `
  const rows = await sql`
    SELECT to_char(dose_date, 'YYYY-MM-DD') AS date, slot, given_by, given_at
    FROM   fabian_doses
    WHERE  dose_date = ${date}::date AND slot = ${slot}
  ` as Row[]
  return rows[0] ? toDto(rows[0]) : null
}
