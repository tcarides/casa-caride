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
  // Una fila por dosis. PK (dose_date, slot) → no se puede dar dos veces.
  // given_by = quién la dio; given_at = cuándo (para el "hace 2 h").
  await sql`
    CREATE TABLE IF NOT EXISTS fabian_doses (
      dose_date DATE        NOT NULL,
      slot      TEXT        NOT NULL CHECK (slot IN ('am', 'pm')),
      given_by  TEXT        NOT NULL,
      given_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (dose_date, slot)
    )
  `
  schemaReady = true
}

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
