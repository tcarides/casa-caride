/**
 * Content script para ZonaProp
 *
 * ZonaProp usa Next.js. El JSON con todos los datos de la propiedad
 * está embebido en <script id="__NEXT_DATA__">.
 *
 * Si la estructura cambia, abrir DevTools → Console y correr:
 *   JSON.parse(document.getElementById('__NEXT_DATA__').textContent)
 * para explorar la forma del objeto y ajustar los paths de abajo.
 */

import type { ExtractedData } from '../shared/types'

function isDetailPage(): boolean {
  // Las páginas de detalle tienen ID numérico al final de la URL
  // Ej: /propiedades/casa-venta-san-isidro-12345678.html
  return /\/propiedades\/.+-\d{6,}\.html/.test(location.pathname)
}

function extractFromNextData(): ExtractedData | null {
  const el = document.getElementById('__NEXT_DATA__')
  if (!el?.textContent) return null

  try {
    const json = JSON.parse(el.textContent)

    // Path más común en ZonaProp — puede variar entre versiones
    // Explorar: json.props.pageProps.listPostingResponse o json.props.pageProps.propertyData
    const pp = json?.props?.pageProps

    // Intentamos múltiples paths conocidos
    const listing =
      pp?.listPostingResponse?.listPosting?.[0] ??
      pp?.property ??
      pp?.postingData ??
      pp?.data

    if (!listing) {
      console.warn('[CompCasa/ZP] No encontré el objeto de listing en __NEXT_DATA__. Paths:', Object.keys(pp ?? {}))
      return null
    }

    // Extraer ID desde URL como fallback
    const urlMatch = location.pathname.match(/-(\d+)\.html$/)
    const externalId = String(listing.id ?? listing.postingId ?? urlMatch?.[1] ?? Date.now())

    // Precio — ZonaProp puede tener múltiples monedas
    const priceObj = listing.price ?? listing.priceTotal ?? listing.operationTypePrice
    const price = Number(priceObj?.amount ?? priceObj?.price ?? priceObj ?? 0)
    const currencyRaw = String(priceObj?.currency ?? priceObj?.currencyCode ?? 'USD').toUpperCase()
    const currency = currencyRaw === 'ARS' ? 'ARS' : 'USD'

    // Fotos
    const photos: string[] = []
    const rawPhotos = listing.photos ?? listing.images ?? listing.multimedia?.photos ?? []
    for (const p of rawPhotos) {
      const url = typeof p === 'string' ? p : (p.url ?? p.src ?? p.image ?? '')
      if (url) photos.push(url)
    }

    // Atributos (m2, ambientes, etc.) — vienen como array de { id, value }
    const attrs: Record<string, string | number> = {}
    const rawAttrs = listing.attributes ?? listing.mainFeatures ?? listing.features ?? []
    for (const a of rawAttrs) {
      if (a.id) attrs[a.id] = a.value ?? a.textValue
    }

    const surface = listing.surface ?? {}
    const m2Total = Number(attrs['surface_total'] ?? attrs['totalArea'] ?? surface.total ?? 0) || undefined
    const m2Covered = Number(attrs['surface_covered'] ?? attrs['coveredArea'] ?? surface.covered ?? 0) || undefined
    const rooms = Number(attrs['rooms'] ?? attrs['ambiences'] ?? listing.rooms ?? 0) || undefined
    const bathrooms = Number(attrs['bathrooms'] ?? listing.bathrooms ?? 0) || undefined
    const garages = Number(attrs['garages'] ?? listing.garages ?? listing.parking ?? 0) || undefined
    const expenses = Number(attrs['expenses'] ?? listing.expenses ?? 0) || undefined

    // Dirección
    const loc = listing.location ?? listing.address ?? listing.geo ?? {}
    const address = (
      [
        listing.address?.streetName ?? loc.streetName ?? '',
        listing.address?.streetNumber ?? loc.streetNumber ?? '',
      ].filter(Boolean).join(' ')
    ) || (loc.shortAddress ?? loc.name ?? listing.title ?? '')

    const neighborhood = loc.neighborhood?.name ?? loc.zone?.name ?? loc.subzone?.name ?? ''

    return {
      source: 'zonaprop',
      externalId,
      url: location.href,
      title: String(listing.title ?? listing.publishTitle ?? ''),
      price,
      currency,
      address,
      neighborhood: neighborhood || undefined,
      m2Total,
      m2Covered,
      rooms,
      bathrooms,
      garages,
      expenses,
      photos,
      description: String(listing.description ?? listing.descriptionNormalized ?? ''),
    }
  } catch (err) {
    console.error('[CompCasa/ZP] Error parseando __NEXT_DATA__:', err)
    return null
  }
}

function extractFromDOM(): ExtractedData | null {
  // Fallback: scraping del DOM visible
  // Útil si ZonaProp cambia su estructura interna
  try {
    const urlMatch = location.pathname.match(/-(\d+)\.html$/)
    const externalId = urlMatch?.[1]
    if (!externalId) return null

    const title =
      document.querySelector('h1')?.textContent?.trim() ??
      document.querySelector('[class*="title"]')?.textContent?.trim() ??
      ''

    // Precio: buscar elemento que contenga símbolo monetario
    const priceText =
      document.querySelector('[class*="price"]')?.textContent?.trim() ??
      document.querySelector('[data-qa="price"]')?.textContent?.trim() ??
      ''
    const priceMatch = priceText.replace(/\./g, '').match(/[\d,]+/)
    const price = priceMatch ? Number(priceMatch[0].replace(',', '.')) : 0
    const currency = priceText.includes('$') && !priceText.includes('USD') ? 'ARS' : 'USD'

    // Fotos
    const photos = Array.from(
      document.querySelectorAll('[class*="gallery"] img, [class*="photo"] img, [class*="carousel"] img')
    )
      .map(img => (img as HTMLImageElement).src)
      .filter(src => src && !src.includes('data:') && !src.includes('placeholder'))
      .slice(0, 30)

    // Dirección
    const address =
      document.querySelector('[class*="address"]')?.textContent?.trim() ??
      document.querySelector('[class*="location"]')?.textContent?.trim() ??
      ''

    console.warn('[CompCasa/ZP] Usando extracción por DOM (menos confiable). Datos pueden ser incompletos.')

    return {
      source: 'zonaprop',
      externalId,
      url: location.href,
      title,
      price,
      currency,
      address,
      photos,
    }
  } catch (err) {
    console.error('[CompCasa/ZP] Error en extracción DOM:', err)
    return null
  }
}

function main() {
  if (!isDetailPage()) return

  const data = extractFromNextData() ?? extractFromDOM()

  if (!data) {
    console.warn('[CompCasa/ZP] No se pudo extraer información de esta propiedad.')
    return
  }

  if (!data.title && !data.price) {
    console.warn('[CompCasa/ZP] Datos extraídos parecen vacíos — puede que la estructura cambió.')
    console.log('[CompCasa/ZP] Datos parciales:', data)
  } else {
    console.log('[CompCasa/ZP] Propiedad extraída:', data.title, data.price, data.currency)
  }

  chrome.runtime.sendMessage({ type: 'PROPERTY_EXTRACTED', data })
}

main()
