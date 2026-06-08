/**
 * Scraper para ArgenpProp (argenprop.com)
 *
 * Estructura HTML:
 * - <a class="card" data-item-card="ID" href="/url-propiedad-ID">
 * - <span class="card__currency">USD</span> PRECIO
 * - <p class="card__address"> DIRECCION
 * - <p class="card__title--primary"> TITULO/ZONA
 * - <ul class="card__main-features"> con iconos de m2/dorm/banos
 * - <img src="..."> primera foto
 * - data-track-montonormalizado="PRECIO_NUM"
 * - data-track-idmoneda="2" (2=USD, 1=ARS aprox)
 *
 * Paginacion: ?pagina-N
 */

import { config } from '../../config.js'
import { upsertProperty } from '../db.js'
import { fetchPage, makeId, sleep } from '../utils.js'
import type { ScrapedProperty, ScrapeResult } from '../types.js'

const BASE = 'https://www.argenprop.com'

// ArgenProp corta la paginación ~página 100 (1980 avisos). Si una búsqueda
// supera el cap, la partimos por rango de precio (USD) hasta entrar bajo el tope.
const PAGE_CAP = 1900
const MAX_DEPTH = 12
const PRICE_TOP = 100_000_000 // tope USD efectivo
const MAX_CONSECUTIVE_KNOWN = 3

interface PriceRange { from: number; to: number }

/** Segmento de path del filtro de precio en USD. */
function priceSeg(r: PriceRange): string {
  if (r.from <= 0) return `hasta-${r.to}-dolares`
  if (r.to >= PRICE_TOP) return `desde-${r.from}-dolares`
  return `${r.from}-${r.to}-dolares`
}

/** El filtro de precio va en el path; la paginación en query (?pagina-N). */
function buildPageUrl(baseUrl: string, page: number, range?: PriceRange): string {
  const path = range ? `${baseUrl}/${priceSeg(range)}` : baseUrl
  return page > 1 ? `${path}?pagina-${page}` : path
}

/** Total que ArgenProp reporta en el <title> ("2.724 Casas en Venta..."). */
function extractTotal(html: string): number | null {
  const m = html.match(/<title>\s*([\d.]+)\s+(?:Casas|PH|Departamentos|Propiedades)/i)
  return m ? parseInt(m[1].replace(/\./g, ''), 10) : null
}

function decodeHtml(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#xB2;/g, 'u00b2').replace(/&nbsp;/g, ' ')
}

function parseFeature(html: string, iconName: string): number | undefined {
  // Buscar el li que contiene el icon de iconName y extraer el numero del span
  const regex = new RegExp(`basico1-icon-${iconName}[^<]*<\/i>[\s\S]*?<span>[\s\S]*?([\d,.]+)[\s\S]*?<\/span>`)
  const m = html.match(regex)
  if (!m) return undefined
  return parseFloat(m[1].replace(/\./g, '').replace(/,/, '.')) || undefined
}

function parseListings(html: string): ScrapedProperty[] {
  const listings: ScrapedProperty[] = []

  // Encontrar todos los cards via data-item-card (el href viene antes en el HTML)
  const cardRegex = /data-item-card="(\d+)"/g
  let m: RegExpExecArray | null

  while ((m = cardRegex.exec(html)) !== null) {
    const externalId = m[1]

    // Backtrack para encontrar el href en el <a> que contiene este card
    const before = html.slice(Math.max(0, m.index - 400), m.index)
    const hrefMatch = before.match(/href="(\/[^"]+--\d+)"\s/)
    const href = hrefMatch?.[1] ?? `/propiedad-${externalId}`
    const url = `${BASE}${href}`

    const cardStart = Math.max(0, m.index - 400)
    const nextCardIdx = html.indexOf('data-item-card="', m.index + 10)
    const cardHtml = html.slice(cardStart, nextCardIdx > 0 ? Math.min(nextCardIdx + 400, cardStart + 7000) : cardStart + 7000)

    // Precio desde data attributes (mas confiable que el texto)
    const montoMatch = cardHtml.match(/data-track-montonormalizado="(\d+)"/)
    const monedaMatch = cardHtml.match(/data-track-idmoneda="(\d+)"/)
    const price = montoMatch ? Number(montoMatch[1]) : undefined
    // idmoneda: 2=USD, 1=ARS (basado en ejemplo con 825000 USD)
    const currency: 'USD' | 'ARS' = (monedaMatch?.[1] === '1') ? 'ARS' : 'USD'

    // Foto
    const imgMatch = cardHtml.match(/src="(https:\/\/www\.argenprop\.com\/static-content\/[^"]+)"/)
    const photos = imgMatch ? [imgMatch[1]] : []

    // Direccion
    const addrMatch = cardHtml.match(/class="card__address"[^>]*>\s*([\s\S]*?)\s*<\/p>/)
    const address = addrMatch ? decodeHtml(addrMatch[1]).trim() : ''

    // Titulo/zona
    const titleMatch = cardHtml.match(/class="card__title--primary"[^>]*>\s*([\s\S]*?)\s*<\/p>/)
    const title = titleMatch ? decodeHtml(titleMatch[1]).trim().replace(/\n/g, ' ').replace(/\s+/g, ' ') : ''

    // Features section
    const featMatch = cardHtml.match(/class="card__main-features"[^>]*>([\s\S]*?)<\/ul>/)
    const featHtml = featMatch ? featMatch[1] : ''

    // M2 cubierto: icono superficie_cubierta
    // M2 total: icono superficie_total
    // Dormitorios: icono cantidad_dormitorios
    // Banios: icono cantidad_banios
    // Cocheras: icono cantidad_cocheras o cocheras
    const m2Covered = parseFeature(featHtml, 'superficie_cubierta')
    const m2Total = parseFeature(featHtml, 'superficie_total')
    const rooms = parseFeature(featHtml, 'cantidad_ambientes')
    const bathrooms = parseFeature(featHtml, 'cantidad_banios') ?? parseFeature(featHtml, 'banos')
    const garages = parseFeature(featHtml, 'cantidad_cocheras') ?? parseFeature(featHtml, 'cocheras')

    // Barrio/zona desde el titulo: "Casa en Venta en Martinez Vias / Santa Fe, Martinez"
    const neighborhood = title.split(',').pop()?.trim() ?? ''

    listings.push({
      source: 'argenprob',
      externalId,
      url,
      title,
      price,
      currency,
      address,
      neighborhood: neighborhood || undefined,
      m2Total,
      m2Covered,
      rooms,
      bathrooms,
      garages,
      photos,
    })
  }

  return listings
}

/** Pagina una búsqueda (opcionalmente filtrada por rango) hasta agotarla o el cap. */
async function paginate(
  baseUrl: string,
  propertyType: 'casa' | 'ph',
  result: ScrapeResult,
  range: PriceRange | undefined,
  label: string,
): Promise<void> {
  const cfg = config.argenprob
  let consecutiveKnown = 0
  const seenThisSearch = new Set<string>()
  for (let page = 1; page <= cfg.maxPages; page++) {
    process.stdout.write(`[ArgenpProp] ${label} pág ${page}... `)
    const html = await fetchPage(buildPageUrl(baseUrl, page, range))
    if (!html) { result.errors++; console.log('error'); break }

    const listings = parseListings(html).map(l => ({ ...l, propertyType }))
    console.log(`${listings.length} propiedades`)
    if (listings.length === 0) break

    // ArgenProp, más allá del último resultado real, REPITE la última página en vez
    // de devolver vacío. Si ningún aviso es nuevo para ESTA búsqueda, llegamos al final.
    const addedThisPage = listings.filter(l => !seenThisSearch.has(l.externalId)).length
    listings.forEach(l => seenThisSearch.add(l.externalId))
    if (addedThisPage === 0) {
      console.log(`[ArgenpProp] página repetida (fin de resultados), deteniendo.`)
      break
    }

    let pageNew = 0, pageUpdated = 0, pageKnown = 0
    for (const prop of listings) {
      result.total++
      const id = makeId('argenprob', prop.externalId)
      const r = upsertProperty({ ...prop, id })
      if (r.isNew) { pageNew++; result.newCount++ }
      else if (r.priceChanged) { pageUpdated++; result.updated++; console.log(`  Precio: ${id} ${r.oldPrice} -> ${prop.price}`) }
      else { pageKnown++ }
    }
    console.log(`  -> ${pageNew} nuevas, ${pageUpdated} precio cambio, ${pageKnown} ya conocidas`)

    // FULL_SWEEP=1 (flag --full) ignora el corte por "todo conocido": barre TODO.
    // Necesario para un rellenado completo si la DB ya tiene data parcial vieja.
    const sweepAll = process.env.FULL_SWEEP === '1'
    if (!sweepAll && pageNew === 0 && pageUpdated === 0) {
      if (config.scraper.stopOnAllKnown && ++consecutiveKnown >= MAX_CONSECUTIVE_KNOWN) {
        console.log(`[ArgenpProp] ${MAX_CONSECUTIVE_KNOWN} páginas consecutivas conocidas, deteniendo.`)
        break
      }
    } else consecutiveKnown = 0

    if (page < cfg.maxPages) await sleep(config.scraper.delayBetweenRequests)
  }
}

/** Punto de corte para bisección de precio (geométrico, con piso de $50k). */
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
): Promise<void> {
  const range = { from, to }
  const label = `[$${Math.round(from / 1000)}k-${to >= PRICE_TOP ? '∞' : Math.round(to / 1000) + 'k'}]`
  const html = await fetchPage(buildPageUrl(baseUrl, 1, range))
  const total = html ? extractTotal(html) : null

  const mid = midpoint(from, to)
  const canSplit = total !== null && total > PAGE_CAP && depth < MAX_DEPTH && mid > from && mid < to
  if (!canSplit) {
    if (total !== null && total > PAGE_CAP) {
      console.log(`[ArgenpProp] ⚠️ ${label} = ${total} (> ${PAGE_CAP}) sin poder partir más; se capturará ~${PAGE_CAP}.`)
    }
    await paginate(baseUrl, propertyType, result, range, label)
    return
  }
  console.log(`[ArgenpProp] ${label} = ${total} > ${PAGE_CAP}, partiendo en $${Math.round(mid / 1000)}k`)
  await scrapeByPrice(baseUrl, propertyType, result, from, mid, depth + 1)
  await scrapeByPrice(baseUrl, propertyType, result, mid, to, depth + 1)
}

export async function scrapeArgenProp(): Promise<ScrapeResult> {
  const result: ScrapeResult = { source: 'ArgenpProp', total: 0, newCount: 0, updated: 0, errors: 0 }
  const cfg = config.argenprob

  console.log(`\n[ArgenpProp] Iniciando scraping...`)

  for (const baseUrl of cfg.searchUrls) {
    const propertyType: 'casa' | 'ph' = baseUrl.includes('/ph/') ? 'ph' : 'casa'
    console.log(`[ArgenpProp] URL: ${baseUrl} (${propertyType})`)

    // Si la categoría supera el cap de paginación, partimos por rango de precio
    // (USD). Los avisos en pesos los convierte ArgenProp dentro del filtro USD.
    const html = await fetchPage(buildPageUrl(baseUrl, 1))
    const total = html ? extractTotal(html) : null
    if (total !== null && total > PAGE_CAP) {
      console.log(`[ArgenpProp] ${total} resultados (> ${PAGE_CAP}): split por rango de precio.`)
      await scrapeByPrice(baseUrl, propertyType, result, 0, PRICE_TOP, 0)
    } else {
      await paginate(baseUrl, propertyType, result, undefined, 'cat')
    }
  }

  return result
}
