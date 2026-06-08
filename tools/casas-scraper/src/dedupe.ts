/**
 * Script de dedup. Dos pasadas:
 *   1. Calcula phash de la primera foto de cada propiedad que no lo tenga
 *   2. Encuentra pares candidatos por Hamming distance ≤ THRESHOLD
 *
 * Output:
 *   - Actualiza webapp/data/properties.json con los phash
 *   - Sube los pares candidatos a la DB (tabla property_dedupe_candidates)
 *
 * Uso: npm run dedupe
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { computeHashFromUrl, hammingDistance } from './photoHash.js'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', '..', 'webapp', 'data', 'properties.json')

config({ path: join(__dirname, '..', '..', 'webapp', '.env.local') })

const HASH_CONCURRENCY = 8
const HASH_DELAY_MS = 100
const HAMMING_THRESHOLD = 10  // ≤ 10 bits de diferencia = candidatos

interface Property {
  id: string
  source: string
  url: string
  photos: string[]
  phash?: string
  propertyType?: string
  address?: string
  neighborhood?: string
  price?: number
  m2Total?: number
  [key: string]: unknown
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ArgenProp bloquea el hotlink de sus imágenes (403 server-side) → no se pueden
// foto-hashear. Las salteamos para no malgastar la corrida.
function isHashable(p: Property): boolean {
  const u = p.photos?.[0]
  return !!u && !u.includes('argenprop.com/static-content')
}

async function step1_computeHashes(properties: Property[]): Promise<number> {
  const toProcess = properties.filter(p => !p.phash && isHashable(p))
  console.log(`\n📷 Paso 1: Calculando hash de ${toProcess.length} fotos (ArgenProp se saltea: 403 hotlink)...\n`)

  if (toProcess.length === 0) return 0

  let done = 0
  let failed = 0

  for (let i = 0; i < toProcess.length; i += HASH_CONCURRENCY) {
    const batch = toProcess.slice(i, i + HASH_CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (p) => ({ id: p.id, hash: await computeHashFromUrl(p.photos[0]) }))
    )

    for (const r of results) {
      done++
      const prop = properties.find(p => p.id === r.id)
      if (prop && r.hash) {
        prop.phash = r.hash
      } else {
        failed++
      }
    }

    if (done % 100 === 0 || i + HASH_CONCURRENCY >= toProcess.length) {
      console.log(`  ${done}/${toProcess.length} hashes (${failed} fallaron)`)
      // Guardar progreso parcial cada 100
      writeFileSync(DB_PATH, JSON.stringify(properties, null, 2), 'utf-8')
    }

    await sleep(HASH_DELAY_MS)
  }

  console.log(`  Total: ${done - failed} ok, ${failed} fallaron`)
  return done - failed
}

interface Candidate {
  prop_a: string
  prop_b: string
  hamming: number
  same_address: boolean
  same_price_5pct: boolean
  same_m2_5pct: boolean
}

function step2_findCandidates(properties: Property[]): Candidate[] {
  console.log(`\n🔍 Paso 2: Buscando candidatos (threshold ≤ ${HAMMING_THRESHOLD} bits)...\n`)

  const withHash = properties.filter(p => p.phash)
  console.log(`  Comparando ${withHash.length} propiedades con hash`)

  // Agrupar por tipo para reducir comparaciones
  const byType = new Map<string, Property[]>()
  for (const p of withHash) {
    const type = p.propertyType ?? 'unknown'
    const arr = byType.get(type) ?? []
    arr.push(p)
    byType.set(type, arr)
  }

  const candidates: Candidate[] = []
  for (const [type, group] of byType) {
    console.log(`  Tipo ${type}: ${group.length} propiedades, ${(group.length * (group.length - 1)) / 2} pares posibles`)
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        // Mismo source = misma propiedad en el mismo sitio, no es duplicado entre sites
        if (a.source === b.source) continue
        const dist = hammingDistance(a.phash!, b.phash!)
        if (dist <= HAMMING_THRESHOLD) {
          candidates.push({
            prop_a: a.id,
            prop_b: b.id,
            hamming: dist,
            same_address: !!(a.address && b.address && normalizeAddr(a.address) === normalizeAddr(b.address)),
            same_price_5pct: similar(a.price, b.price, 0.05),
            same_m2_5pct: similar(a.m2Total, b.m2Total, 0.05),
          })
        }
      }
    }
  }

  candidates.sort((x, y) => x.hamming - y.hamming)
  console.log(`  Encontrados ${candidates.length} pares candidatos`)
  return candidates
}

function normalizeAddr(s: string): string {
  return s.toLowerCase()
    .replace(/\bav(\.|enida)?\b/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function similar(a: number | undefined, b: number | undefined, tolerance: number): boolean {
  if (a === undefined || b === undefined) return false
  const max = Math.max(a, b)
  if (max === 0) return false
  return Math.abs(a - b) / max <= tolerance
}

// Precio normalizado a USD para elegir la "primary" (la más barata).
// La mayoría de los listings están en USD; los ARS se convierten con una tasa aprox.
const ARS_PER_USD = 1200
function toUSD(p: Property): number {
  const price = typeof p.price === 'number' ? p.price : undefined
  if (price === undefined) return Infinity
  return p.currency === 'ARS' ? price / ARS_PER_USD : price
}

// Score de "completitud" de info — para el desempate y el pill "+ info" en la webapp.
function completeness(p: Property): number {
  let s = Math.min((p.photos?.length ?? 0), 12)
  for (const k of ['m2Total', 'm2Covered', 'rooms', 'bathrooms', 'garages', 'address', 'title']) {
    const v = p[k]
    if (v !== undefined && v !== null && v !== '') s += 2
  }
  return s
}

/**
 * Paso 3 (AUTO-MERGE): arma grupos de duplicados y los escribe directo en Postgres
 * (property_groups + property_group_members), que es lo que la webapp ya usa para
 * mostrar una sola card (primary) + los links a las otras plataformas (siblings).
 * - Preserva los grupos manuales existentes (los siembra en el union-find).
 * - Respeta los pares rechazados (no los une).
 * - primary = MENOR precio (USD); desempate por completitud.
 * - Idempotente: reconstruye las tablas en cada corrida.
 */
async function step3_autoMerge(properties: Property[], candidates: Candidate[]) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.log('\n⚠️  Sin DATABASE_URL — no puedo escribir grupos. Corré `vercel env pull webapp/.env.local`.')
    return
  }
  const { sql } = await import('@vercel/postgres')
  await sql`CREATE TABLE IF NOT EXISTS property_groups (group_id TEXT PRIMARY KEY, primary_id TEXT NOT NULL)`
  await sql`CREATE TABLE IF NOT EXISTS property_group_members (property_id TEXT PRIMARY KEY, group_id TEXT NOT NULL)`
  await sql`CREATE TABLE IF NOT EXISTS property_dedupe_rejected (prop_a TEXT, prop_b TEXT, PRIMARY KEY (prop_a, prop_b))`

  // Union-Find
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    if (!parent.has(x)) { parent.set(x, x); return x }
    let root = x
    while (parent.get(root)! !== root) root = parent.get(root)!
    let cur = x
    while (parent.get(cur)! !== root) { const nx = parent.get(cur)!; parent.set(cur, root); cur = nx }
    return root
  }
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }

  // 1) Sembrar con grupos manuales existentes (preservarlos)
  const existing = await sql`SELECT property_id, group_id FROM property_group_members`
  const byGroup = new Map<string, string[]>()
  for (const r of existing.rows as { property_id: string; group_id: string }[]) {
    const arr = byGroup.get(r.group_id) ?? []; arr.push(r.property_id); byGroup.set(r.group_id, arr)
  }
  for (const ids of byGroup.values()) for (let i = 1; i < ids.length; i++) union(ids[0], ids[i])

  // 2) Pares rechazados (no unir)
  const rejected = new Set<string>()
  const rej = await sql`SELECT prop_a, prop_b FROM property_dedupe_rejected`
  for (const r of rej.rows as { prop_a: string; prop_b: string }[]) rejected.add([r.prop_a, r.prop_b].sort().join('|'))

  // 3) Candidatos fuertes (umbral conservador para auto-merge sin revisión)
  const MERGE_HAMMING = 8
  let pairsAdded = 0
  for (const c of candidates) {
    if (c.hamming > MERGE_HAMMING) continue
    if (!(c.same_address || c.same_m2_5pct || c.same_price_5pct)) continue
    if (rejected.has([c.prop_a, c.prop_b].sort().join('|'))) continue
    if (find(c.prop_a) !== find(c.prop_b)) pairsAdded++
    union(c.prop_a, c.prop_b)
  }

  // 4) Componentes con ≥2 miembros
  const comps = new Map<string, string[]>()
  for (const id of parent.keys()) { const r = find(id); const a = comps.get(r) ?? []; a.push(id); comps.set(r, a) }
  const byId = new Map(properties.map(p => [p.id, p]))
  const groups = [...comps.values()].filter(ids => ids.filter(id => byId.has(id)).length >= 2)

  // 5) Reconstruir tablas (idempotente)
  await sql`DELETE FROM property_group_members`
  await sql`DELETE FROM property_groups`
  let gCount = 0, mCount = 0
  for (const ids of groups) {
    const members = ids.filter(id => byId.has(id))
    if (members.length < 2) continue
    const primary = members.slice().sort((a, b) =>
      (toUSD(byId.get(a)!) - toUSD(byId.get(b)!)) || (completeness(byId.get(b)!) - completeness(byId.get(a)!)))[0]
    const groupId = randomUUID()
    await sql`INSERT INTO property_groups (group_id, primary_id) VALUES (${groupId}, ${primary})`
    // batch: un solo INSERT con todos los miembros del grupo
    const values = members.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')
    const params = members.flatMap(id => [id, groupId])
    await sql.query(`INSERT INTO property_group_members (property_id, group_id) VALUES ${values}`, params)
    gCount++; mCount += members.length
  }
  console.log(`\n🔗 Auto-merge: ${gCount} grupos, ${mCount} propiedades agrupadas (${pairsAdded} pares nuevos unidos).`)
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('🔗 Dedupe — auto-merge de duplicados cross-plataforma')
  console.log('═══════════════════════════════════════════')

  const properties: Property[] = JSON.parse(readFileSync(DB_PATH, 'utf-8'))
  console.log(`Cargadas ${properties.length} propiedades`)

  await step1_computeHashes(properties)
  writeFileSync(DB_PATH, JSON.stringify(properties, null, 2), 'utf-8')

  const candidates = step2_findCandidates(properties)
  await step3_autoMerge(properties, candidates)

  console.log('\n✅ Listo. Grupos aplicados (primary = menor precio). La webapp muestra 1 card + links a las otras plataformas.')
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
