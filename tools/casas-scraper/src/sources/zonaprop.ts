/**
 * Scraper para ZonaProp
 *
 * ZonaProp usa HTML server-side con atributos data-id, data-qa para precio/features/ubicacion.
 * Paginacion: -pagina-N antes del .html
 */

import { config } from '../../config.js'
import { upsertProperty } from '../db.js'
import { fetchPage, makeId, sleep } from '../utils.js'
import type { ScrapedProperty, ScrapeResult } from '../types.js'

const BASE = 'https://www.zonaprop.com.ar'

// ZonaProp está detrás de Cloudflare: bloquea las páginas profundas (~después de
// la página 9 ≈ 270 avisos) con un interstitial "Just a moment". El bloqueo es
// por-búsqueda (una URL nueva resetea), así que dividimos por barrio y, los barrios
// grandes, también por ambientes, para que cada búsqueda quede bajo el límite.
const AMBIENTES = ['1-ambiente', '2-ambientes', '3-ambientes', '4-ambientes', 'mas-de-5-ambientes']
const MAX_CONSECUTIVE_KNOWN = 3

// Slugs que NO son barrios de la zona (otros partidos vecinos o filtros estructurales).
const NEIGHBOR_DENY = [
  'gba-norte', 'vicente-lopez', 'tigre', 'capital-federal', 'nordelta', 'escobar',
  'pilar', 'general-pacheco', 'don-torcuato', 'benavidez', 'garin', 'ingeniero-maschwitz',
  'general-san-martin', 'san-martin', 'villa-ballester', 'jose-leon-suarez', 'san-andres',
  'billinghurst', 'loma-hermosa', 'villa-lynch', 'villa-maipu', // partido Gral San Martín (vecino)
  'san-fernando', 'san-isidro', // la zona misma / la otra zona (los barrios reales no son exactamente esto)
]
const STRUCTURAL = [
  'pagina', 'ambiente', 'bano', 'garage', 'dormitorio', 'mas-de', 'menos-de', 'dolar',
  'peso', 'metros', 'antiguedad', 'credito', 'financ', 'emprendimiento', 'pozo', 'terreno', 'm2',
]

function buildPageUrl(baseUrl: string, page: number): string {
  if (page === 1) return baseUrl
  return baseUrl.replace(/\.html$/, `-pagina-${page}.html`)
}

/** Detecta el interstitial de Cloudflare ("Just a moment..."). */
function isCloudflareBlock(html: string): boolean {
  return html.length < 20000 && (html.includes('Just a moment') || html.includes('challenge-platform') || html.includes('cf-browser-verification'))
}

/**
 * Extrae slugs de barrio de la página de una zona. ZonaProp linkea otras búsquedas
 * como `casas-venta-<slug>.html`. Filtramos partidos vecinos y filtros estructurales.
 */
function extractBarrioSlugs(html: string, tipoPrefix: string, zonaSlug: string): string[] {
  const re = new RegExp(`${tipoPrefix}-venta-([a-z0-9-]+?)\\.html`, 'g')
  const slugs = new Set<string>()
  for (const m of html.matchAll(re)) {
    const slug = m[1]
    if (slug === zonaSlug) continue
    if (NEIGHBOR_DENY.includes(slug)) continue
    if (STRUCTURAL.some(k => slug.includes(k))) continue
    slugs.add(slug)
  }
  return [...slugs]
}

function decodeHtml(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

function parsePrice(priceText: string): { price?: number; currency?: 'USD' | 'ARS' } {
  const clean = priceText.replace(/\./g, '').replace(/,/g, '.').trim()
  const usdMatch = clean.match(/USD\s*([\d]+)/i)
  const arsMatch = clean.match(/\$\s*([\d]+)/)
  if (usdMatch) return { price: Number(usdMatch[1]), currency: 'USD' }
  if (arsMatch) return { price: Number(arsMatch[1]), currency: 'ARS' }
  return {}
}

function parseFeatureSpans(html: string): { m2Total?: number; m2Covered?: number; rooms?: number; bathrooms?: number; garages?: number } {
  const spans = html.match(/<span[^>]*>(.*?)<\/span>/g) ?? []
  const texts = spans.map(s => s.replace(/<[^>]+>/g, '').trim())
  const result: ReturnType<typeof parseFeatureSpans> = {}
  for (const t of texts) {
    const n = parseFloat(t.replace(/[^\d.]/g, ''))
    if (!n) continue
    if (t.includes('tot')) result.m2Total = n
    else if (t.includes('cub')) result.m2Covered = n
    else if ((t.includes('m\u00b2') || t.includes('m2')) && !result.m2Total) result.m2Total = n
    else if (t.includes('amb')) result.rooms = n
    else if (t.includes('ba\u00f1')) result.bathrooms = n
    else if (t.includes('coch') || t.includes('gar')) result.garages = n
  }
  return result
}

function parseListings(html: string): ScrapedProperty[] {
  const listings: ScrapedProperty[] = []
  const cardRegex = /data-id="(\d+)"/g
  let m: RegExpExecArray | null

  while ((m = cardRegex.exec(html)) !== null) {
    const externalId = m[1]
    const cardStart = m.index
    const nextCardIdx = html.indexOf('data-id="', cardStart + 10)
    const cardHtml = html.slice(cardStart, nextCardIdx > 0 ? Math.min(nextCardIdx, cardStart + 5000) : cardStart + 5000)

    const urlMatch = cardHtml.match(/data-to-posting="([^"]+)"/)
    const url = urlMatch
      ? `https://www.zonaprop.com.ar${decodeHtml(urlMatch[1]).split('?')[0]}`
      : `https://www.zonaprop.com.ar/propiedades/${externalId}.html`

    const imgMatch = cardHtml.match(/src="(https:\/\/imgar\.zonapropcdn\.com\/[^"]+)"/)
    const photos = imgMatch ? [imgMatch[1]] : []

    const priceMatch = cardHtml.match(/data-qa="POSTING_CARD_PRICE"[^>]*>([^<]+)</)
    const { price, currency } = priceMatch ? parsePrice(decodeHtml(priceMatch[1])) : {}

    const featuresMatch = cardHtml.match(/data-qa="POSTING_CARD_FEATURES"[^>]*>([\s\S]*?)<\/h3>/)
    const features = featuresMatch ? parseFeatureSpans(featuresMatch[1]) : {}

    const locationMatch = cardHtml.match(/data-qa="POSTING_CARD_LOCATION"[^>]*>([^<]+)</)
    const locationText = locationMatch ? decodeHtml(locationMatch[1]).trim() : ''
    const [neighborhood] = locationText.split(',').map(s => s.trim())

    const altMatch = cardHtml.match(/alt="([^"]+)"/)
    const title = altMatch ? decodeHtml(altMatch[1]).trim() : ''

    listings.push({
      source: 'zonaprop',
      externalId,
      url,
      title,
      price,
      currency,
      address: locationText,
      neighborhood: neighborhood || undefined,
      ...features,
      photos,
    })
  }
  return listings
}

/**
 * Pagina una búsqueda hasta agotarla, el cap, o un bloqueo de Cloudflare.
 * Devuelve 'blocked' si CF cortó (la búsqueda era > ~270 → conviene sub-dividir),
 * o 'complete' si llegó al final real (página vacía o repetida).
 */
async function paginate(
  baseUrl: string,
  propertyType: 'casa' | 'ph',
  result: ScrapeResult,
  label: string,
): Promise<'complete' | 'blocked'> {
  const cfg = config.zonaprop
  let consecutiveKnown = 0
  const seenThisSearch = new Set<string>()
  for (let page = 1; page <= cfg.maxPages; page++) {
    process.stdout.write(`[ZonaProp] ${label} pág ${page}... `)
    const html = await fetchPage(buildPageUrl(baseUrl, page))
    if (!html) { result.errors++; console.log('error'); return 'blocked' }
    if (isCloudflareBlock(html)) { console.log('🛑 Cloudflare'); return 'blocked' }

    const listings = parseListings(html).map(l => ({ ...l, propertyType }))
    console.log(`${listings.length} propiedades`)
    if (listings.length === 0) return 'complete'

    const added = listings.filter(l => !seenThisSearch.has(l.externalId)).length
    listings.forEach(l => seenThisSearch.add(l.externalId))
    if (added === 0) { console.log('[ZonaProp] página repetida (fin), deteniendo.'); return 'complete' }

    let pageNew = 0, pageUpdated = 0, pageKnown = 0
    for (const prop of listings) {
      result.total++
      const id = makeId('zonaprop', prop.externalId)
      const r = upsertProperty({ ...prop, id })
      if (r.isNew) { pageNew++; result.newCount++ }
      else if (r.priceChanged) { pageUpdated++; result.updated++; console.log(`  Precio: ${id} ${r.oldPrice} -> ${prop.price}`) }
      else { pageKnown++ }
    }
    console.log(`  -> ${pageNew} nuevas, ${pageUpdated} precio cambio, ${pageKnown} ya conocidas`)

    const sweepAll = process.env.FULL_SWEEP === '1'
    if (!sweepAll && pageNew === 0 && pageUpdated === 0) {
      if (config.scraper.stopOnAllKnown && ++consecutiveKnown >= MAX_CONSECUTIVE_KNOWN) {
        console.log(`[ZonaProp] ${MAX_CONSECUTIVE_KNOWN} páginas consecutivas conocidas, deteniendo.`)
        return 'complete'
      }
    } else consecutiveKnown = 0

    if (page < cfg.maxPages) await sleep(config.scraper.delayBetweenRequests)
  }
  return 'complete'
}

export async function scrapeZonaProp(): Promise<ScrapeResult> {
  const result: ScrapeResult = { source: 'ZonaProp', total: 0, newCount: 0, updated: 0, errors: 0 }
  const cfg = config.zonaprop

  console.log(`\n[ZonaProp] Iniciando scraping...`)

  for (const baseUrl of cfg.searchUrls) {
    const propertyType: 'casa' | 'ph' = baseUrl.includes('ph-venta') ? 'ph' : 'casa'
    const tipoPrefix = baseUrl.includes('ph-venta') ? 'ph' : 'casas'
    const zonaSlug = baseUrl.match(/venta-([a-z-]+)\.html$/)?.[1] ?? ''
    console.log(`[ZonaProp] URL: ${baseUrl} (${propertyType}, zona=${zonaSlug})`)

    // 1) Pasada general por zona. Si CF bloquea (>270), igual capturó el top;
    //    el resto lo cubrimos por barrio. Aprovechamos el HTML para listar barrios.
    const firstHtml = await fetchPage(baseUrl)
    await paginate(baseUrl, propertyType, result, 'general')

    // 2) Pasada por barrio (cada barrio resetea el límite de Cloudflare).
    const barrios = firstHtml && !isCloudflareBlock(firstHtml)
      ? extractBarrioSlugs(firstHtml, tipoPrefix, zonaSlug)
      : []
    if (barrios.length) console.log(`[ZonaProp] ${barrios.length} barrios en ${zonaSlug}: ${barrios.join(', ')}`)

    for (const slug of barrios) {
      const barrioUrl = `${BASE}/${tipoPrefix}-venta-${slug}.html`
      const status = await paginate(barrioUrl, propertyType, result, slug)
      // 3) Barrio grande (CF lo cortó) → sub-split por ambientes.
      if (status === 'blocked') {
        console.log(`[ZonaProp] ${slug} superó el límite → split por ambientes.`)
        for (const amb of AMBIENTES) {
          await paginate(`${BASE}/${tipoPrefix}-venta-${slug}-${amb}.html`, propertyType, result, `${slug} ${amb}`)
        }
      }
    }
  }

  return result
}
