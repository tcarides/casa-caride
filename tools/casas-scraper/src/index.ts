/**
 * Orquestador principal del scraper
 *
 * Uso:
 *   npm run scrape                    → todas las fuentes
 *   npm run scrape:zp                 → solo ZonaProp
 *   npm run scrape:ap                 → solo ArgenProp
 *   npm run scrape:ml                 → solo MercadoLibre
 *   DEBUG=1 npm run scrape:zp         → guarda JSON para debugging
 */

import { scrapeZonaProp } from './sources/zonaprop.js'
import { scrapeArgenProp } from './sources/argenprob.js'
import { scrapeMercadoLibre } from './sources/mercadolibre.js'
import { flush } from './db.js'
import type { ScrapeResult } from './types.js'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
mkdirSync(join(__dirname, '../data'), { recursive: true })

// Qué source correr (desde CLI: --source zonaprop)
const sourceArg = process.argv.find(a => a.startsWith('--source='))?.split('=')[1]
  ?? (process.argv.includes('--source') ? process.argv[process.argv.indexOf('--source') + 1] : null)

// --full: barrido completo (ignora el corte por "todo conocido"). Lo seteamos como
// env var para que lo lean los scrapers en runtime. Garantiza cobertura total.
if (process.argv.includes('--full')) process.env.FULL_SWEEP = '1'

async function main() {
  const startTime = Date.now()
  console.log('═══════════════════════════════════════════')
  console.log('🏠  Compra Casa — Scraper')
  console.log(`⏰  ${new Date().toLocaleString('es-AR')}`)
  if (process.env.FULL_SWEEP === '1') console.log('🧹  Modo FULL SWEEP (barrido completo)')
  console.log('═══════════════════════════════════════════')

  const scrapers: Array<() => Promise<ScrapeResult>> = []

  if (!sourceArg || sourceArg === 'zonaprop')    scrapers.push(scrapeZonaProp)
  if (!sourceArg || sourceArg === 'argenprob')   scrapers.push(scrapeArgenProp)
  if (!sourceArg || sourceArg === 'mercadolibre') scrapers.push(scrapeMercadoLibre)

  if (scrapers.length === 0) {
    console.error(`Source desconocido: "${sourceArg}". Opciones: zonaprop, argenprob, mercadolibre`)
    process.exit(1)
  }

  const results: ScrapeResult[] = []

  // Corremos en serie para no saturar los servidores
  for (const scraper of scrapers) {
    try {
      const result = await scraper()
      results.push(result)
    } catch (err) {
      console.error(`Error en scraper:`, err)
    } finally {
      flush() // volcar a disco las re-confirmaciones acumuladas en cache
    }
  }

  // Resumen final
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const totalNew = results.reduce((s, r) => s + r.newCount, 0)
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0)
  const totalFound = results.reduce((s, r) => s + r.total, 0)

  console.log('\n═══════════════════════════════════════════')
  console.log('📊  Resumen')
  console.log('═══════════════════════════════════════════')

  for (const r of results) {
    const status = r.errors > 0 ? '⚠️ ' : '✅'
    console.log(`${status} ${r.source.padEnd(15)} ${r.total.toString().padStart(4)} encontradas | ${r.newCount.toString().padStart(4)} nuevas | ${r.updated} actualizadas`)
  }

  console.log('───────────────────────────────────────────')
  console.log(`   ${'TOTAL'.padEnd(15)} ${totalFound.toString().padStart(4)} encontradas | ${totalNew.toString().padStart(4)} nuevas | ${totalUpdated} actualizadas`)
  console.log(`\n⏱  Tiempo: ${elapsed}s`)

  if (totalNew > 0) {
    console.log(`\n🆕 Hay ${totalNew} propiedades nuevas para revisar`)
  } else {
    console.log(`\n✓ Sin novedades`)
  }
  console.log('═══════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
