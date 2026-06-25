/**
 * Sube a Postgres (property_discontinued) las caídas que el cleanup ya marcó en
 * el JSON (discontinuedBy='cleanup'), sin re-chequear las URLs.
 * Replica markInDb() de cleanup.ts: INSERT ... ON CONFLICT DO NOTHING
 * (no pisa las 16 existentes ni marcas manuales).
 *
 * Uso: npx tsx src/push-caidas.mts
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', '..', '..', 'apps', 'casas', 'data', 'properties.json')
config({ path: join(__dirname, '..', '..', '..', 'apps', 'casas', '.env.local') })

if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  console.error('✗ Sin DATABASE_URL/POSTGRES_URL en apps/casas/.env.local')
  process.exit(1)
}

const props: Array<{ id: string; discontinuedAt?: string; discontinuedBy?: string }> =
  JSON.parse(readFileSync(DB_PATH, 'utf-8'))
const ids = props.filter(p => p.discontinuedAt).map(p => p.id)
console.log(`Caídas en el JSON a subir: ${ids.length}`)

const { sql } = await import('@vercel/postgres')
const before = (await sql`SELECT count(*)::int AS n FROM property_discontinued`).rows[0].n

// Upsert batcheado con unnest (1 round-trip por chunk).
const CHUNK = 500
let pushed = 0
for (let i = 0; i < ids.length; i += CHUNK) {
  const chunk = ids.slice(i, i + CHUNK)
  await sql.query(
    `INSERT INTO property_discontinued (property_id, discontinued_at, marked_by)
     SELECT x, NOW(), 'cleanup' FROM unnest($1::text[]) AS x
     ON CONFLICT (property_id) DO NOTHING`,
    [chunk]
  )
  pushed += chunk.length
  console.log(`  ${pushed}/${ids.length} procesadas`)
}

const after = (await sql`SELECT count(*)::int AS n FROM property_discontinued`).rows[0].n
console.log(`✓ property_discontinued: ${before} → ${after} (nuevas: ${after - before})`)
process.exit(0)
