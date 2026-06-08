/**
 * Content script para ArgenProp
 *
 * ArgenProp también usa React/Next.js y embebe datos en __NEXT_DATA__.
 * URL de detalle real: /[tipo]-en-venta-en-[zona]-...--[id]
 *   ej: https://www.argenprop.com/ph-en-venta-en-san-fernando-7-ambientes--19524193
 * El ID es el bloque de dígitos al final de la URL.
 *
 * Si falla, abrir DevTools → Console:
 *   JSON.parse(document.getElementById('__NEXT_DATA__').textContent)
 */

import type { ExtractedData } from '../shared/types'

function isDetailPage(): boolean {
  // Las fichas de detalle terminan en "-<id>" con ID numérico largo
  return /-\d{5,}\/?$/.test(location.pathname)
}

function extractFromNextData(): ExtractedData | null {
  const el = document.getElementById('__NEXT_DATA__')
  if (!el?.textContent) return null

  try {
    const json = JSON.parse(el.textContent)
    const pp = json?.props?.pageProps

    // ArgenProp típicamente usa pageProps.property o pageProps.posting
    const listing =
      pp?.property ??
      pp?.posting ??
      pp?.propertyDetail ??
      pp?.data?.property

    if (!listing) {
      console.warn('[CompCasa/AP] No encontré el listing en __NEXT_DATA__. Paths:', Object.keys(pp ?? {}))
      return null
    }

    const urlMatch = location.pathname.match(/-(\d+)\/?$/)
    const externalId = String(listing.id ?? listing.propertyId ?? urlMatch?.[1] ?? Date.now())

    // Precio
    const priceObj = listing.price ?? listing.salePrice ?? listing.prices?.[0]
    const price = Number(priceObj?.amount ?? priceObj?.value ?? priceObj ?? 0)
    const currencyRaw = String(priceObj?.currency ?? priceObj?.currencyCode ?? 'USD').toUpperCase()
    const currency = currencyRaw.includes('ARS') || currencyRaw.includes('PES') ? 'ARS' : 'USD'

    // Fotos
    const photos: string[] = []
    const rawPhotos =
      listing.photos ??
      listing.images ??
      listing.gallery ??
      listing.multimedia ??
      []
    for (const p of rawPhotos) {
      const url = typeof p === 'string' ? p : (p.url ?? p.src ?? p.original ?? p.large ?? '')
      if (url) photos.push(url.startsWith('http') ? url : `https:${url}`)
    }

    // Características
    const features = listing.features ?? listing.characteristics ?? listing.attributes ?? {}
    const m2Total = Number(
      features.totalSurface ?? features.total_surface ?? features.surface ?? listing.totalSurface ?? 0
    ) || undefined
    const m2Covered = Number(
      features.coveredSurface ?? features.covered_surface ?? listing.coveredSurface ?? 0
    ) || undefined
    const rooms = Number(
      features.rooms ?? features.ambiances ?? features.bedrooms ?? listing.rooms ?? 0
    ) || undefined
    const bathrooms = Number(features.bathrooms ?? features.toilettes ?? listing.bathrooms ?? 0) || undefined
    const garages = Number(features.garages ?? features.parkings ?? listing.garages ?? 0) || undefined
    const expenses = Number(
      listing.expenses ?? listing.maintenanceFee ?? features.expenses ?? 0
    ) || undefined

    // Ubicación
    const loc = listing.location ?? listing.address ?? listing.geo ?? {}
    const parts = [
      listing.address?.street ?? loc.street ?? loc.streetName ?? '',
      listing.address?.number ?? loc.number ?? loc.streetNumber ?? '',
    ].filter(Boolean)
    const address = parts.join(' ') || (loc.fullAddress ?? loc.address ?? listing.title ?? '')
    const neighborhood =
      loc.neighborhood ?? loc.zone ?? loc.barrio ?? listing.neighborhood ?? ''

    return {
      source: 'argenprob',
      externalId,
      url: location.href,
      title: String(listing.title ?? listing.name ?? ''),
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
      description: String(listing.description ?? listing.observations ?? ''),
    }
  } catch (err) {
    console.error('[CompCasa/AP] Error parseando __NEXT_DATA__:', err)
    return null
  }
}

function extractFromDOM(): ExtractedData | null {
  try {
    const urlMatch = location.pathname.match(/-(\d+)\/?$/)
    const externalId = urlMatch?.[1]
    if (!externalId) return null

    const title = document.querySelector('h1')?.textContent?.trim() ?? ''

    const priceText =
      document.querySelector('[class*="price"]')?.textContent?.trim() ??
      document.querySelector('[class*="Price"]')?.textContent?.trim() ??
      ''
    const priceMatch = priceText.replace(/\./g, '').match(/[\d,]+/)
    const price = priceMatch ? Number(priceMatch[0].replace(',', '.')) : 0
    const currency = priceText.includes('$') && !priceText.includes('USD') ? 'ARS' : 'USD'

    const photos = Array.from(
      document.querySelectorAll('[class*="gallery"] img, [class*="photo"] img, [class*="slider"] img')
    )
      .map(img => (img as HTMLImageElement).src)
      .filter(src => src && !src.includes('data:'))
      .slice(0, 30)

    const address =
      document.querySelector('[class*="address"]')?.textContent?.trim() ??
      document.querySelector('[class*="location"]')?.textContent?.trim() ??
      ''

    console.warn('[CompCasa/AP] Usando extracción por DOM.')

    return { source: 'argenprob', externalId, url: location.href, title, price, currency, address, photos }
  } catch (err) {
    console.error('[CompCasa/AP] Error en extracción DOM:', err)
    return null
  }
}

function main() {
  if (!isDetailPage()) return

  const data = extractFromNextData() ?? extractFromDOM()

  if (!data) {
    console.warn('[CompCasa/AP] No se pudo extraer información.')
    return
  }

  console.log('[CompCasa/AP] Propiedad extraída:', data.title, data.price, data.currency)
  chrome.runtime.sendMessage({ type: 'PROPERTY_EXTRACTED', data })
}

main()
