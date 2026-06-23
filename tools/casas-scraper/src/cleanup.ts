/**
 * Revisa todas las propiedades y MARCA como "caídas" las que ya no están
 * disponibles (404/410), en vez de borrarlas. Así quedan guardadas con sus
 * fotos en la sección /caidas de la webapp.
 *
 * - JSON: setea discontinuedAt / discontinuedBy='cleanup' (no elimina nada).
 * - Postgres (si hay DATABASE_URL): upsert en property_discontinued, que es de
 *   donde la webapp lee el estado en producción. No pisa marcas manuales.
 *
 * Uso: npm run cleanup
 */
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', '..', '..', 'apps', 'casas', 'data', 'properties.json')

config({ path: join(__dirname, '..', '..', '..', 'apps', 'casas', '.env.local') })

const CONCURRENCY = 10
const DELAY_MS = 300

interface Property {
  id: string
  url: string
  source: string
  status: string
  discontinuedAt?: string
  discontinuedBy?: string
  [key: string]: unknown
}

async function checkUrl(url: string): Promise<number> {
  try {
    const cmd = `curl -s -o /dev/null -w "%{http_code}" --max-time 15 -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${url}"`
    const { stdout } = await execAsync(cmd, { timeout: 20000 })
    return parseInt(stdout.trim()) || 0
  } catch (err: unknown) {
    // curl exits non-zero on 4xx/5xx but stdout still has the status code
    const stdout = (err as { stdout?: string }).stdout ?? ''
    const code = parseInt(stdout.trim())
    if (code > 0) return code
    return 0 // actual timeout/network error — skip
  }
}

function isGone(status: number): boolean {
  // 410 Gone, 404 Not Found
  return status === 410 || status === 404
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

/** Persiste las marcas en Postgres si hay conexión. No pisa marcas existentes. */
async function markInDb(ids: string[]) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.log('\n⚠️  Sin DATABASE_URL — las caídas quedan sólo en el JSON. Corré `vercel env pull` para reflejarlas en producción.')
    return
  }
  const { sql } = await import('@vercel/postgres')
  await sql`
    CREATE TABLE IF NOT EXISTS property_discontinued (
      property_id     TEXT PRIMARY KEY,
      discontinued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      marked_by       TEXT
    )
  `
  let n = 0
  for (const id of ids) {
    await sql`
      INSERT INTO property_discontinued (property_id, discontinued_at, marked_by)
      VALUES (${id}, NOW(), 'cleanup')
      ON CONFLICT (property_id) DO NOTHING
    `
    n++
  }
  console.log(`☁️  ${n} caídas marcadas en la DB (property_discontinued).`)
}

async function main() {
  const properties: Property[] = JSON.parse(readFileSync(DB_PATH, 'utf-8'))
  console.log(`\n🔍 Revisando ${properties.length} propiedades...\n`)

  const toMark: Set<string> = new Set()
  let checked = 0
  let errors = 0

  for (let i = 0; i < properties.length; i += CONCURRENCY) {
    const batch = properties.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (p) => {
        let code = await checkUrl(p.url)
        // Un 404/410 puede ser transitorio (rate-limit, hiccup del sitio).
        // Reverificamos una vez antes de dar la baja por definitiva.
        if (isGone(code)) {
          await sleep(1000)
          code = await checkUrl(p.url)
        }
        return { id: p.id, url: p.url, source: p.source, code }
      })
    )

    for (const r of results) {
      checked++
      if (isGone(r.code)) {
        toMark.add(r.id)
        console.log(`  ⬇️  ${r.code} ${r.source} ${r.url}`)
      } else if (r.code === 0) {
        errors++
      }
    }

    if (checked % 100 === 0 || i + CONCURRENCY >= properties.length) {
      console.log(`  ... ${checked}/${properties.length} revisadas, ${toMark.size} caídas, ${errors} errores`)
    }

    await sleep(DELAY_MS)
  }

  if (toMark.size === 0) {
    console.log('\n✅ Todas las propiedades siguen activas.')
    return
  }

  // Marcar en el JSON (conservando la propiedad y sus fotos)
  const now = new Date().toISOString()
  let newlyMarked = 0
  for (const p of properties) {
    if (toMark.has(p.id) && !p.discontinuedAt) {
      p.discontinuedAt = now
      p.discontinuedBy = 'cleanup'
      newlyMarked++
    }
  }
  writeFileSync(DB_PATH, JSON.stringify(properties, null, 2))

  await markInDb([...toMark])

  console.log(`\n📥 ${toMark.size} propiedades caídas guardadas (${newlyMarked} nuevas en el JSON).`)
  console.log(`📊 ${properties.length} propiedades en total (no se borró ninguna).`)
}

main().catch(console.error)
