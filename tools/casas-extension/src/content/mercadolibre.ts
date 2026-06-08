/**
 * Content script para MercadoLibre Inmuebles
 *
 * ML embebe los datos en window.__PRELOADED_STATE__ o en JSON-LD.
 * El ID de la propiedad está en la URL: MLA-XXXXXXXXX (MLA = Argentina).
 * Las fichas de inmuebles viven en subdominios como casa./inmueble./departamento.
 *
 * Si falla, abrir DevTools → Console:
 *   window.__PRELOADED_STATE__
 *   document.querySelector('script[type="application/ld+json"]').textContent
 */

import type { ExtractedData } from '../shared/types'

function isDetailPage(): boolean {
  // Páginas de detalle tienen -_JM en la URL, o un ID MLA/MLU explícito
  return /-_JM\d*/.test(location.href) || /\/ML[AU]-?\d+/i.test(location.href)
}

function extractExternalId(): string {
  // MLA = Argentina (también aceptamos MLU por las dudas)
  const match = location.href.match(/ML[AU]-?(\d+)/i) ?? location.href.match(/-(\d+)-_JM/)
  return match?.[1] ?? String(Date.now())
}

function extractFromPreloadedState(): ExtractedData | null {
  try {
    // MercadoLibre embebe en window.__PRELOADED_STATE__
    const rawState = (window as unknown as Record<string, unknown>).__PRELOADED_STATE__
    if (!rawState) return null

    // La estructura es: state.initialState.components.variations o state.vip.components
    const state = rawState as Record<string, unknown>
    const initialState = (state.initialState ?? state.vip) as Record<string, unknown> | undefined
    if (!initialState) return null

    // Buscar el componente de precio
    const components = (initialState.components ?? {}) as Record<string, unknown>

    // Extraer precio desde el componente price o header
    const priceComp = components.price as Record<string, unknown> | undefined
    const headerComp = components.header as Record<string, unknown> | undefined

    const priceAmount = Number(
      (priceComp as Record<string, unknown> | undefined)?.price ??
      (priceComp as Record<string, unknown> | undefined)?.amount ??
      0
    )
    const currencyId = String(
      (priceComp as Record<string, unknown> | undefined)?.currency_id ?? 'USD'
    )
    const currency = currencyId === 'ARS' ? 'ARS' : 'USD'

    // Título
    const title = String(
      (headerComp as Record<string, unknown> | undefined)?.title ??
      initialState.title ??
      ''
    )

    // Fotos desde gallery component
    const galleryComp = (components.gallery ?? components.pictures) as Record<string, unknown> | undefined
    const rawPics = (galleryComp?.pictures ?? galleryComp?.items ?? []) as Array<Record<string, string>>
    const photos = rawPics
      .map(p => p.url ?? p.secure_url ?? p.src ?? '')
      .filter(Boolean)
      .map(url => url.replace(/-[A-Z]\.jpg/, '-O.jpg')) // Pedir versión original (mayor calidad)

    // Atributos desde el componente specs
    const specsComp = (components.specs ?? components.attributes) as Record<string, unknown> | undefined
    const attrs = new Map<string, string | number>()
    const groups = (specsComp as Record<string, unknown> | undefined)?.groups as Array<{
      attributes: Array<{ id: string; value_name?: string; values?: Array<{ name: string }> }>
    }> | undefined
    if (groups) {
      for (const group of groups) {
        for (const attr of group.attributes ?? []) {
          const val = attr.value_name ?? attr.values?.[0]?.name ?? ''
          if (attr.id && val) attrs.set(attr.id, val)
        }
      }
    }

    const parseAttrNum = (id: string) => {
      const v = attrs.get(id)
      return v ? Number(String(v).replace(/\D/g, '')) || undefined : undefined
    }

    // Ubicación
    const locationComp = (components.map ?? initialState.location) as Record<string, unknown> | undefined
    const locationData = (locationComp?.location ?? locationComp) as Record<string, unknown> | undefined
    const address = String(
      (locationData as Record<string, unknown> | undefined)?.address_line ??
      (locationData as Record<string, unknown> | undefined)?.name ??
      ''
    )
    const neighborhood = String(
      (locationData as Record<string, unknown> | undefined)?.neighborhood?.name ??
      (locationData as Record<string, unknown> | undefined)?.city?.name ??
      ''
    )

    const externalId = extractExternalId()

    return {
      source: 'mercadolibre',
      externalId,
      url: location.href,
      title,
      price: priceAmount,
      currency,
      address,
      neighborhood: neighborhood || undefined,
      m2Total: parseAttrNum('TOTAL_AREA'),
      m2Covered: parseAttrNum('COVERED_AREA'),
      rooms: parseAttrNum('ROOMS'),
      bathrooms: parseAttrNum('FULL_BATHROOMS') ?? parseAttrNum('BATHROOMS'),
      garages: parseAttrNum('PARKING_LOTS'),
      photos,
    }
  } catch (err) {
    console.error('[CompCasa/ML] Error extrayendo __PRELOADED_STATE__:', err)
    return null
  }
}

function extractFromJSONLD(): ExtractedData | null {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (const script of scripts) {
      const json = JSON.parse(script.textContent ?? '')
      if (json['@type'] !== 'Product' && json['@type'] !== 'RealEstateListing') continue

      const externalId = extractExternalId()
      const offers = json.offers ?? {}
      const price = Number(offers.price ?? 0)
      const currencyRaw = String(offers.priceCurrency ?? 'USD')
      const currency = currencyRaw === 'ARS' ? 'ARS' : 'USD'

      const photos = (json.image ?? []).map((img: string | { url: string }) =>
        typeof img === 'string' ? img : img.url
      ).filter(Boolean)

      return {
        source: 'mercadolibre',
        externalId,
        url: location.href,
        title: String(json.name ?? ''),
        price,
        currency,
        address: String(json.address?.streetAddress ?? json.address ?? ''),
        neighborhood: String(json.address?.addressLocality ?? ''),
        photos,
        description: String(json.description ?? ''),
      }
    }
    return null
  } catch {
    return null
  }
}

function extractFromDOM(): ExtractedData | null {
  try {
    const externalId = extractExternalId()

    const title =
      document.querySelector('h1.ui-pdp-title')?.textContent?.trim() ??
      document.querySelector('h1')?.textContent?.trim() ??
      ''

    const priceText =
      document.querySelector('.andes-money-amount__fraction')?.textContent?.trim() ??
      document.querySelector('[class*="price__fraction"]')?.textContent?.trim() ??
      ''
    const price = Number(priceText.replace(/\./g, '').replace(',', '.')) || 0
    const currencySymbol = document.querySelector('.andes-money-amount__currency-symbol')?.textContent?.trim()
    const currency = currencySymbol === '$' ? 'ARS' : 'USD'

    const photos = Array.from(document.querySelectorAll('.ui-pdp-gallery__figure img, .ui-pdp-image'))
      .map(img => (img as HTMLImageElement).src)
      .filter(src => src && !src.includes('data:'))
      .slice(0, 30)

    const address =
      document.querySelector('.ui-vip-location__map-link')?.textContent?.trim() ??
      document.querySelector('[class*="location"]')?.textContent?.trim() ??
      ''

    console.warn('[CompCasa/ML] Usando extracción por DOM.')

    return { source: 'mercadolibre', externalId, url: location.href, title, price, currency, address, photos }
  } catch (err) {
    console.error('[CompCasa/ML] Error en extracción DOM:', err)
    return null
  }
}

function main() {
  if (!isDetailPage()) return

  const data = extractFromPreloadedState() ?? extractFromJSONLD() ?? extractFromDOM()

  if (!data) {
    console.warn('[CompCasa/ML] No se pudo extraer información.')
    return
  }

  console.log('[CompCasa/ML] Propiedad extraída:', data.title, data.price, data.currency)
  chrome.runtime.sendMessage({ type: 'PROPERTY_EXTRACTED', data })
}

main()
