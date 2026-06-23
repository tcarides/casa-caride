/**
 * Geocoding script: convierte direcciones de texto a lat/lon usando Nominatim (OSM).
 *
 * Reglas Nominatim ToS:
 *   - 1 req/seg máximo
 *   - User-Agent identificable obligatorio
 *
 * Idempotente: solo procesa propiedades sin lat/lon (o con geocoded='failed').
 *
 * Uso: npm run geocode
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', '..', '..', 'apps', 'casas', 'data', 'properties.json')

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'compra-casa-personal/1.0 (tomascaride@gmail.com)'
const DELAY_MS = 1100  // > 1 seg para respetar ToS
const SAVE_EVERY = 25

interface Property {
  id: string
  source: string
  address?: string
  neighborhood?: string
  url?: string
  lat?: number
  lon?: number
  geocoded?: 'ml' | 'nominatim' | 'failed'
  [key: string]: unknown
}

interface NominatimResult {
  lat: string
  lon: string
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Detecta zona del slug en URLs de ArgenpProp y ZonaProp.
 */
function detectZona(p: Property): string | undefined {
  const url = (p.url ?? '').toLowerCase()
  if (url.includes('san-isidro')) return 'San Isidro'
  if (url.includes('san-fernando')) return 'San Fernando'
  return undefined
}

function buildQueries(p: Property): string[] {
  const zona = detectZona(p)
  const addr = p.address?.trim()
  const hood = p.neighborhood?.trim()
  const queries: string[] = []
  // 1: dirección + zona + país
  if (addr && zona) queries.push(`${addr}, ${zona}, Buenos Aires, Argentina`)
  // 2: dirección + barrio + país (sin zona, por si el barrio es específico)
  if (addr && hood && hood !== 'Buenos Aires' && hood !== zona) queries.push(`${addr}, ${hood}, Argentina`)
  // 3: solo dirección + país (último recurso)
  if (addr) queries.push(`${addr}, Argentina`)
  // 4: barrio + zona (fallback aproximado)
  if (hood && zona && hood !== zona) queries.push(`${hood}, ${zona}, Argentina`)
  return queries
}

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=ar`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) return null
    const data = await res.json() as NominatimResult[]
    if (data.length === 0) return null
    const lat = parseFloat(data[0].lat)
    const lon = parseFloat(data[0].lon)
    if (isNaN(lat) || isNaN(lon)) return null
    return { lat, lon }
  } catch {
    return null
  }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('🌎 Geocode — direcciones → lat/lon')
  console.log('═══════════════════════════════════════════')

  const properties: Property[] = JSON.parse(readFileSync(DB_PATH, 'utf-8'))
  console.log(`Cargadas ${properties.length} propiedades`)

  const toGeocode = properties.filter(p =>
    (typeof p.lat !== 'number' || typeof p.lon !== 'number') &&
    p.geocoded !== 'failed' &&  // no reintentar las que ya fallaron antes
    (p.address || p.neighborhood)
  )

  const alreadyGeocoded = properties.filter(p => typeof p.lat === 'number').length
  const failedBefore = properties.filter(p => p.geocoded === 'failed').length

  console.log(`  ${alreadyGeocoded} ya tienen coords (ML embeded o geocode previo)`)
  console.log(`  ${failedBefore} fallaron antes (omitidas)`)
  console.log(`  ${toGeocode.length} a geocodificar`)

  if (toGeocode.length === 0) {
    console.log('\n✅ Nada que hacer.')
    return
  }

  const eta = Math.ceil(toGeocode.length * DELAY_MS / 1000 / 60)
  console.log(`\n⏱  ETA: ~${eta} minutos (1.1 seg por dirección)\n`)

  let ok = 0
  let failed = 0

  for (let i = 0; i < toGeocode.length; i++) {
    const p = toGeocode[i]
    const queries = buildQueries(p)
    let result: { lat: number; lon: number } | null = null

    for (const q of queries) {
      result = await geocode(q)
      await sleep(DELAY_MS)
      if (result) break
    }

    if (result) {
      p.lat = result.lat
      p.lon = result.lon
      p.geocoded = 'nominatim'
      ok++
    } else {
      p.geocoded = 'failed'
      failed++
    }

    if ((i + 1) % SAVE_EVERY === 0 || i === toGeocode.length - 1) {
      writeFileSync(DB_PATH, JSON.stringify(properties, null, 2), 'utf-8')
      console.log(`  ${i + 1}/${toGeocode.length} (${ok} ok, ${failed} fallaron)`)
    }
  }

  console.log(`\n✅ Listo. ${ok} geocodificadas, ${failed} fallaron.`)
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
