/**
 * Aplica el schema a la DB. Corre con: npm run db:migrate
 * Requiere DATABASE_URL en env (vía .env.local o variable de entorno).
 *
 * Idempotente — se puede correr varias veces. Si encuentra la tabla vieja
 * `property_state`, migra sus datos a las nuevas tablas asignándoselos a 'tomi'.
 */
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const SCHEMA_PATH = join(__dirname, '..', 'lib', 'schema.sql')

async function main() {
  const { sql } = await import('@vercel/postgres')

  // 1. Aplicar schema (CREATE TABLE IF NOT EXISTS)
  const schema = readFileSync(SCHEMA_PATH, 'utf-8')
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    console.log(`-> ${stmt.split('\n')[0].slice(0, 80)}...`)
    await sql.query(stmt)
  }

  // 1b. Si la tabla ya existe con CHECK viejo, lo recreamos con los nuevos statuses
  console.log('-> Actualizando CHECK constraint de status (si hace falta)...')
  await sql`ALTER TABLE property_user_state DROP CONSTRAINT IF EXISTS property_user_state_status_check`
  await sql`
    ALTER TABLE property_user_state
    ADD CONSTRAINT property_user_state_status_check
    CHECK (status IN ('unseen', 'seen', 'maybe', 'favorite', 'discarded'))
  `

  // 1c. Asegurar columna author_id en property_notes (idempotente)
  console.log('-> Agregando author_id a property_notes (si hace falta)...')
  await sql`ALTER TABLE property_notes ADD COLUMN IF NOT EXISTS author_id TEXT`

  // 2. Migrar datos viejos si existe la tabla `property_state`
  const { rows } = await sql`
    SELECT to_regclass('property_state') AS exists
  `
  const oldTableExists = rows[0]?.exists !== null

  if (oldTableExists) {
    console.log('-> Migrando data de la tabla vieja property_state a tomi...')

    const { rows: statusRows } = await sql`
      INSERT INTO property_user_state (property_id, user_id, status, updated_at)
      SELECT property_id, 'tomi', status, updated_at FROM property_state
      ON CONFLICT (property_id, user_id) DO NOTHING
      RETURNING property_id
    `
    console.log(`   ${statusRows.length} status migrados`)

    const { rows: notesRows } = await sql`
      INSERT INTO property_notes (property_id, notes, updated_at)
      SELECT property_id, notes, updated_at FROM property_state
      WHERE notes IS NOT NULL AND notes != ''
      ON CONFLICT (property_id) DO NOTHING
      RETURNING property_id
    `
    console.log(`   ${notesRows.length} notas migradas`)

    await sql`DROP TABLE property_state`
    console.log('   Tabla vieja eliminada')
  }

  console.log('✅ Migración completada')
}

main().catch((err) => {
  console.error('❌ Error en migración:', err)
  process.exit(1)
})
