/**
 * Scraper para MercadoLibre Inmuebles
 *
 * ML embede los datos de propiedades en un JSON "product_list" dentro del HTML.
 * Contiene: id, name, price, currency, url, address, rooms, m2, foto thumbnail.
 *
 * Paginación: ?Desde=48, ?Desde=96, etc.
 */

import { config } from '../../config.js'
import { upsertProperty } from '../db.js'
import { makeId, sleep } from '../utils.js'
import { fetchMercadoLibrePage, preflightMl } from '../ml-fetch.js'
import type { ScrapedProperty, ScrapeResult } from '../types.js'

interface MLProductItem {
  id: string
  name?: string
  image?: string
  item_offered?: {
    price?: number
    price_currency?: string
    url?: string
  }
  address?: {
    address_locality?: string
    address_region?: string
    street_address?: string
  }
  // ML a veces incluye coords como geo o location
  geo?: { latitude?: number; longitude?: number }
  location?: { latitude?: number; longitude?: number }
  latitude?: number
  longitude?: number
  number_of_rooms?: number
  floor_size?: { value?: number; unit_code?: string }
  date_posted?: string
}

const PAGE_SIZE = 48

interface PriceRange { from: number; to: number } // USD; from/to en dólares, to>=PRICE_TOP = abierto

/**
 * Construye la URL de una página, opcionalmente filtrada por rango de precio.
 * ML pagina y filtra por PATH (el viejo `?Desde=N` ya no funciona). Formato canónico:
 *   /zona/_Desde_<N>_PriceRange_<from>USD-<to>USD_NoIndex_True?<query>
 * `_NoIndex_True` es obligatorio en páginas > 1 (sin él ML hace 301 a la página 1).
 * El orden importa: _Desde primero, luego _PriceRange, luego _NoIndex_True.
 */
function buildPageUrl(baseUrl: string, page: number, range?: PriceRange): string {
  const [path, query] = baseUrl.split('?')
  let segs = ''
  if (page > 1) segs += `_Desde_${(page - 1) * PAGE_SIZE + 1}`
  if (range) segs += `_PriceRange_${range.from}USD-${range.to}USD`
  if (page > 1) segs += '_NoIndex_True'
  const paged = segs ? `${path}${segs}` : path
  return query ? `${paged}?${query}` : paged
}

/** Total de resultados que ML reporta para la búsqueda (embebido en el HTML). */
function extractTotal(html: string): number | null {
  const m = html.match(/"total":(\d+),"category_id"/)
  return m ? parseInt(m[1], 10) : null
}

/** Slug de zona (san-isidro / san-fernando) a partir de la baseUrl. */
function zoneSlug(baseUrl: string): string {
  return baseUrl.split('?')[0].split('/').filter(Boolean).pop() ?? ''
}

/**
 * Extrae los barrios del filtro de la página (slug + nombre legible).
 * ML embebe los links del filtro de barrios como
 *   .../<zona>/<slug>/#...applied_filter_name=Barrios...applied_value_name=<nombre>...
 */
function extractBarrios(html: string, zona: string): { slug: string; name: string }[] {
  const clean = html.replace(/\\u002F/g, '/').replace(/\\"/g, '"').replace(/&amp;/g, '&')
  const re = new RegExp(
    `${zona}/([a-z0-9-]+)/[^"\\\\]*?applied_filter_name(?:=|%3D)Barrios[^"\\\\]*?applied_value_name(?:=|%3D)([^"\\\\]+?)(?=%26|&|")`,
    'gi',
  )
  const seen = new Map<string, string>()
  for (const m of clean.matchAll(re)) {
    const slug = m[1]
    if (slug.includes('_') || slug === zona) continue
    let name = m[2]
    try { name = decodeURIComponent(m[2].replace(/\+/g, ' ')) } catch { /* dejar crudo */ }
    if (!seen.has(slug)) seen.set(slug, name)
  }
  return [...seen.entries()].map(([slug, name]) => ({ slug, name }))
}

function extractProductList(html: string): MLProductItem[] {
  // ML embebe múltiples "product_list":[...] en el HTML.
  // Tomamos el primero (generalmente el más completo) y extraemos el array
  // usando un parser de balanceo de brackets que maneja strings correctamente.

  const KEY = '"product_list":['
  const startIdx = html.indexOf(KEY)
  if (startIdx === -1) return []

  let i = startIdx + KEY.length
  let depth = 0           // profundidad de { }
  let inString = false
  let escape = false

  // Avanzar hasta el ] de cierre del array (depth 0)
  while (i < html.length) {
    const ch = html[i]
    if (escape) { escape = false; i++; continue }
    if (ch === '\\') { escape = true; i++; continue }
    if (ch === '"') { inString = !inString; i++; continue }
    if (inString) { i++; continue }
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === ']' && depth === 0) break
    i++
  }

  const arrStr = '[' + html.slice(startIdx + KEY.length, i) + ']'
  try {
    return JSON.parse(arrStr) as MLProductItem[]
  } catch {
    return []
  }
}

function parseItem(item: MLProductItem): ScrapedProperty {
  const id = item.id
  const url = item.item_offered?.url?.replace(/\\u002F/g, '/') ?? `https://articulo.mercadolibre.com.ar/${id}`
  const photo = item.image?.replace(/\\u002F/g, '/')

  // ML a veces trae coords; las buscamos en varios campos posibles
  const lat = item.geo?.latitude ?? item.location?.latitude ?? item.latitude
  const lon = item.geo?.longitude ?? item.location?.longitude ?? item.longitude

  return {
    source: 'mercadolibre',
    externalId: id,
    url,
    title: item.name ?? '',
    price: item.item_offered?.price,
    currency: item.item_offered?.price_currency === 'ARS' ? 'ARS' : 'USD',
    address: item.address?.street_address ?? '',
    neighborhood: item.address?.address_locality ?? item.address?.address_region ?? '',
    rooms: item.number_of_rooms,
    m2Total: item.floor_size?.value,
    lat: typeof lat === 'number' ? lat : undefined,
    lon: typeof lon === 'number' ? lon : undefined,
    photos: photo ? [photo] : [],
  }
}

// ML corta la paginación por relevancia alrededor del item ~765 (16 págs) aunque
// el total sea mayor. Si una búsqueda supera el cap, la partimos por rango de precio.
const PAGE_CAP = 750
const MAX_DEPTH = 12          // límite de recursión del split por precio
const PRICE_TOP = 100_000_000 // tope USD efectivo (ninguna propiedad lo supera)
// ML ordena por relevancia (no fecha): "página toda conocida" no implica fin.
// Cortamos tras N páginas consecutivas 100% conocidas (barre todo la 1ª vez, rápido luego).
const MAX_CONSECUTIVE_KNOWN = 3

function processItems(items: MLProductItem[], propertyType: 'casa' | 'ph', result: ScrapeResult, barrio?: string) {
  let pageNew = 0, pageUpdated = 0, pageKnown = 0
  for (const item of items) {
    if (!item.id) continue
    result.total++
    const prop = { ...parseItem(item), propertyType }
    if (barrio) prop.neighborhood = barrio // etiqueta el barrio real (scrape por barrio)
    const id = makeId('mercadolibre', prop.externalId)
    const up = upsertProperty({ ...prop, id })
    if (up.isNew) { pageNew++; result.newCount++ }
    else if (up.priceChanged) {
      pageUpdated++; result.updated++
      console.log(`  💰 Precio cambió: ${id} ${up.oldPrice} → ${prop.price}`)
    } else pageKnown++
  }
  return { pageNew, pageUpdated, pageKnown }
}

/** Pagina una búsqueda (opcionalmente filtrada por rango) hasta agotarla o el cap. */
async function paginate(
  baseUrl: string,
  propertyType: 'casa' | 'ph',
  result: ScrapeResult,
  range: PriceRange | undefined,
  label: string,
  firstHtml?: string | null,
  barrio?: string,
  fullSweep = false,
): Promise<void> {
  const cfg = config.mercadolibre
  let consecutiveKnown = 0
  for (let page = 1; page <= cfg.maxPages; page++) {
    process.stdout.write(`[MercadoLibre] ${label} pág ${page}... `)
    const html = page === 1 && firstHtml != null ? firstHtml : await fetchMercadoLibrePage(buildPageUrl(baseUrl, page, range))
    if (!html) { result.errors++; console.log('error al descargar'); break }

    const items = extractProductList(html)
    console.log(`${items.length} propiedades`)
    if (items.length === 0) break

    const { pageNew, pageUpdated, pageKnown } = processItems(items, propertyType, result, barrio)
    console.log(`  → ${pageNew} nuevas, ${pageUpdated} precio cambió, ${pageKnown} ya conocidas`)

    // fullSweep (pasadas por barrio, o flag --full) ignora el corte por "todo
    // conocido": hay que barrer entero. El corte por página vacía sigue valiendo.
    const sweepAll = fullSweep || process.env.FULL_SWEEP === '1'
    if (!sweepAll && pageNew === 0 && pageUpdated === 0) {
      if (config.scraper.stopOnAllKnown && ++consecutiveKnown >= MAX_CONSECUTIVE_KNOWN) {
        console.log(`[MercadoLibre] ${MAX_CONSECUTIVE_KNOWN} páginas consecutivas conocidas, deteniendo.`)
        break
      }
    } else consecutiveKnown = 0

    if (page < cfg.maxPages) await sleep(config.scraper.delayBetweenRequests)
  }
}

/**
 * Punto de corte para bisección de precio: media geométrica (maneja la asimetría
 * de la distribución). Con piso de $50k cuando from=0, para no desperdiciar niveles
 * colapsando el extremo alto vacío y converger rápido a la franja poblada.
 */
function midpoint(from: number, to: number): number {
  const lo = from <= 0 ? 50_000 : from
  return Math.round(Math.sqrt(lo * to))
}

/** Scrapea un rango [from,to] USD; si supera el cap de paginación, lo parte en dos. */
async function scrapeByPrice(
  baseUrl: string,
  propertyType: 'casa' | 'ph',
  result: ScrapeResult,
  from: number,
  to: number,
  depth: number,
  barrio?: string,
  fullSweep = false,
): Promise<void> {
  const range = { from, to }
  const label = `${barrio ? barrio + ' ' : ''}[$${Math.round(from / 1000)}k-${to >= PRICE_TOP ? '∞' : Math.round(to / 1000) + 'k'}]`
  const html = await fetchMercadoLibrePage(buildPageUrl(baseUrl, 1, range))
  const total = html ? extractTotal(html) : null
  if (total === 0) return

  const mid = midpoint(from, to)
  const canSplit = total !== null && total > PAGE_CAP && depth < MAX_DEPTH && mid > from && mid < to
  if (!canSplit) {
    if (total !== null && total > PAGE_CAP) {
      console.log(`[MercadoLibre] ⚠️ ${label} = ${total} (> ${PAGE_CAP}) sin poder partir más; se capturará ~${PAGE_CAP}.`)
    }
    await paginate(baseUrl, propertyType, result, range, label, html, barrio, fullSweep)
    return
  }
  console.log(`[MercadoLibre] ${label} = ${total} > ${PAGE_CAP}, partiendo en $${Math.round(mid / 1000)}k`)
  await scrapeByPrice(baseUrl, propertyType, result, from, mid, depth + 1, barrio, fullSweep)
  await scrapeByPrice(baseUrl, propertyType, result, mid, to, depth + 1, barrio, fullSweep)
}

/** Scrapea una búsqueda completa: split por precio si supera el cap, si no paginación simple. */
async function scrapeSearch(
  baseUrl: string,
  propertyType: 'casa' | 'ph',
  result: ScrapeResult,
  label: string,
  barrio?: string,
  fullSweep = false,
): Promise<{ total: number | null; html: string | null }> {
  const html = await fetchMercadoLibrePage(buildPageUrl(baseUrl, 1))
  const total = html ? extractTotal(html) : null
  if (total !== null && total > PAGE_CAP) {
    console.log(`[MercadoLibre] ${label}: ${total} resultados (> ${PAGE_CAP}), split por precio.`)
    await scrapeByPrice(baseUrl, propertyType, result, 0, PRICE_TOP, 0, barrio, fullSweep)
  } else {
    await paginate(baseUrl, propertyType, result, undefined, label, html, barrio, fullSweep)
  }
  return { total, html }
}

export async function scrapeMercadoLibre(): Promise<ScrapeResult> {
  const result: ScrapeResult = { source: 'MercadoLibre', total: 0, newCount: 0, updated: 0, errors: 0 }
  const cfg = config.mercadolibre

  console.log(`\n[MercadoLibre] Iniciando scraping...`)

  // Preflight: si las cookies faltan o expiraron, imprime el paso a paso y saltea
  // ML (sin frenar las demás fuentes).
  if (!(await preflightMl())) {
    console.warn('[MercadoLibre] Salteado por falta de sesión válida.')
    result.errors++
    return result
  }

  for (const baseUrl of cfg.searchUrls) {
    const propertyType: 'casa' | 'ph' = baseUrl.includes('/ph/') ? 'ph' : 'casa'
    const zona = zoneSlug(baseUrl)
    console.log(`[MercadoLibre] URL: ${baseUrl} (${propertyType})`)

    // 1) Pasada general (con split por precio si hace falta). Captura las que ML
    //    no asigna a ningún barrio + sirve para leer la lista de barrios.
    const { html } = await scrapeSearch(baseUrl, propertyType, result, 'cat')

    // 2) Pasada por barrio: etiqueta neighborhood = barrio real. Corre AL FINAL
    //    para que la etiqueta gane sobre la pasada general (upsert sobreescribe).
    const barrios = html ? extractBarrios(html, zona) : []
    if (barrios.length) {
      console.log(`[MercadoLibre] ${barrios.length} barrios en ${zona}: ${barrios.map(b => b.slug).join(', ')}`)
    }
    const [path, query] = baseUrl.split('?')
    for (const b of barrios) {
      const barrioUrl = `${path}${b.slug}/${query ? '?' + query : ''}`
      // fullSweep=true: barrer el barrio entero para etiquetarlo aunque ya estén en DB.
      await scrapeSearch(barrioUrl, propertyType, result, b.name, b.name, true)
    }
  }

  return result
}
