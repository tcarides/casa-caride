import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

type Sql = NeonQueryFunction<false, false>

let _sql: Sql | undefined

/**
 * Devuelve el cliente SQL de Neon, creándolo la primera vez.
 * Lee la cadena de conexión desde las variables de entorno que
 * inyecta la integración de Postgres/Neon en Vercel.
 */
export function getSql(): Sql {
  if (_sql) return _sql
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL
  if (!connectionString) {
    throw new Error(
      'Falta la variable de entorno de la base de datos (DATABASE_URL / POSTGRES_URL).'
    )
  }
  _sql = neon(connectionString)
  return _sql
}

// Datos de la lista que heredó el modelo global anterior (la compra compartida
// de Flor y Tomás): al migrar, esa lista pasa a ser de Tomás y queda compartida
// con Flori. Mails tomados del seed del shell.
const LEGACY_OWNER_EMAIL = 'tomascaride@gmail.com'
const LEGACY_OWNER_NAME = 'Tomás'
const LEGACY_SHARE_EMAIL = 'florencia.pastorini@gmail.com'
const LEGACY_SHARE_NAME = 'Flori'

export const DEFAULT_LIST_NAME = (name: string): string => `Lista de ${name}`

let schemaReady = false

/**
 * Crea/actualiza las tablas si hace falta.
 *
 * Modelo nuevo: una lista por persona, compartible.
 *  - lists:       la lista de cada usuario (una por owner_email).
 *  - list_shares: con quién la comparte el dueño (pueden editar).
 *  - categories:  secciones del súper, ahora dentro de una lista.
 *  - items:       productos, ahora dentro de una lista. Estados:
 *      needed  = está marcado para esta compra
 *      checked = ya lo agarré (tachado)
 */
export async function ensureSchema(): Promise<void> {
  if (schemaReady) return
  const sql = getSql()

  await sql`
    CREATE TABLE IF NOT EXISTS lists (
      id          BIGSERIAL PRIMARY KEY,
      owner_email TEXT NOT NULL UNIQUE,
      owner_name  TEXT NOT NULL,
      name        TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS list_shares (
      list_id BIGINT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      email   TEXT NOT NULL,
      name    TEXT NOT NULL,
      PRIMARY KEY (list_id, email)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id       BIGSERIAL PRIMARY KEY,
      list_id  BIGINT,
      name     TEXT NOT NULL,
      position INT NOT NULL DEFAULT 0
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS items (
      id          BIGSERIAL PRIMARY KEY,
      list_id     BIGINT,
      name        TEXT NOT NULL,
      category_id BIGINT,
      needed      BOOLEAN NOT NULL DEFAULT FALSE,
      checked     BOOLEAN NOT NULL DEFAULT FALSE,
      quantity    INT NOT NULL DEFAULT 1,
      note        TEXT,
      position    INT NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Migraciones de modelos anteriores.
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS category_id BIGINT`
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS needed BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS checked BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1`
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS note TEXT`
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0`
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS list_id BIGINT`
  await sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS list_id BIGINT`

  // Migración del modelo global (sin lists): si quedan categorías o productos
  // "huérfanos" (list_id NULL), son la lista única anterior → la adoptamos como
  // la lista de Tomás, compartida con Flori. Corre una sola vez (después ya no
  // hay huérfanos, así que no re-agrega el share si luego lo sacan).
  const [{ huerfanos }] = (await sql`
    SELECT (
      (SELECT COUNT(*) FROM categories WHERE list_id IS NULL) +
      (SELECT COUNT(*) FROM items WHERE list_id IS NULL)
    )::int AS huerfanos
  `) as { huerfanos: number }[]

  if (huerfanos > 0) {
    await sql`
      INSERT INTO lists (owner_email, owner_name, name)
      VALUES (${LEGACY_OWNER_EMAIL}, ${LEGACY_OWNER_NAME}, ${DEFAULT_LIST_NAME(LEGACY_OWNER_NAME)})
      ON CONFLICT (owner_email) DO NOTHING
    `
    const [legacy] = (await sql`
      SELECT id FROM lists WHERE owner_email = ${LEGACY_OWNER_EMAIL}
    `) as { id: number }[]
    const legacyId = legacy.id
    await sql`UPDATE categories SET list_id = ${legacyId} WHERE list_id IS NULL`
    await sql`UPDATE items SET list_id = ${legacyId} WHERE list_id IS NULL`
    await sql`
      INSERT INTO list_shares (list_id, email, name)
      VALUES (${legacyId}, ${LEGACY_SHARE_EMAIL}, ${LEGACY_SHARE_NAME})
      ON CONFLICT (list_id, email) DO NOTHING
    `
  }

  schemaReady = true
}

// ---------- listas ----------

export interface ListRow {
  id: number
  name: string
  ownerEmail: string
  ownerName: string
}

export interface ListSummary extends ListRow {
  mine: boolean
}

export interface ShareRow {
  email: string
  name: string
}

/**
 * Devuelve la lista propia del usuario, creándola la primera vez.
 * El nombre por defecto es "Lista de {nombre}".
 */
export async function getOrCreateMyList(email: string, name: string): Promise<ListRow> {
  const sql = getSql()
  const e = email.toLowerCase()
  await sql`
    INSERT INTO lists (owner_email, owner_name, name)
    VALUES (${e}, ${name}, ${DEFAULT_LIST_NAME(name)})
    ON CONFLICT (owner_email) DO NOTHING
  `
  const [row] = (await sql`
    SELECT id, name, owner_email AS "ownerEmail", owner_name AS "ownerName"
    FROM lists WHERE owner_email = ${e}
  `) as ListRow[]
  return row
}

/** Todas las listas a las que el usuario tiene acceso (propia + compartidas). */
export async function accessibleLists(email: string): Promise<ListSummary[]> {
  const sql = getSql()
  const e = email.toLowerCase()
  const rows = (await sql`
    SELECT l.id, l.name, l.owner_email AS "ownerEmail", l.owner_name AS "ownerName"
    FROM lists l
    WHERE l.owner_email = ${e}
       OR EXISTS (SELECT 1 FROM list_shares s WHERE s.list_id = l.id AND s.email = ${e})
  `) as ListRow[]
  return rows
    .map((r) => ({ ...r, mine: r.ownerEmail === e }))
    .sort((a, b) => {
      if (a.mine !== b.mine) return a.mine ? -1 : 1
      return a.ownerName.localeCompare(b.ownerName, 'es', { sensitivity: 'base' })
    })
}

export async function canAccessList(listId: number, email: string): Promise<boolean> {
  const sql = getSql()
  const e = email.toLowerCase()
  const rows = await sql`
    SELECT 1 FROM lists l
    WHERE l.id = ${listId}
      AND (l.owner_email = ${e}
           OR EXISTS (SELECT 1 FROM list_shares s WHERE s.list_id = l.id AND s.email = ${e}))
    LIMIT 1
  `
  return rows.length > 0
}

export async function isListOwner(listId: number, email: string): Promise<boolean> {
  const sql = getSql()
  const rows = await sql`
    SELECT 1 FROM lists WHERE id = ${listId} AND owner_email = ${email.toLowerCase()} LIMIT 1
  `
  return rows.length > 0
}

export async function getListById(listId: number): Promise<ListRow | null> {
  const sql = getSql()
  const [row] = (await sql`
    SELECT id, name, owner_email AS "ownerEmail", owner_name AS "ownerName"
    FROM lists WHERE id = ${listId}
  `) as ListRow[]
  return row ?? null
}

export async function renameList(listId: number, name: string): Promise<void> {
  const sql = getSql()
  await sql`UPDATE lists SET name = ${name} WHERE id = ${listId}`
}

export async function listShares(listId: number): Promise<ShareRow[]> {
  const sql = getSql()
  const rows = (await sql`
    SELECT email, name FROM list_shares WHERE list_id = ${listId}
    ORDER BY name ASC
  `) as ShareRow[]
  return rows
}

export async function addShare(listId: number, email: string, name: string): Promise<void> {
  const sql = getSql()
  await sql`
    INSERT INTO list_shares (list_id, email, name)
    VALUES (${listId}, ${email.toLowerCase()}, ${name})
    ON CONFLICT (list_id, email) DO UPDATE SET name = EXCLUDED.name
  `
}

export async function removeShare(listId: number, email: string): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM list_shares WHERE list_id = ${listId} AND email = ${email.toLowerCase()}`
}

// ---------- pertenencia de categorías / items ----------

export async function listIdOfCategory(id: number | string): Promise<number | null> {
  const sql = getSql()
  const [row] = (await sql`SELECT list_id AS "listId" FROM categories WHERE id = ${id}`) as {
    listId: number | null
  }[]
  return row?.listId ?? null
}

export async function listIdOfItem(id: number | string): Promise<number | null> {
  const sql = getSql()
  const [row] = (await sql`SELECT list_id AS "listId" FROM items WHERE id = ${id}`) as {
    listId: number | null
  }[]
  return row?.listId ?? null
}
