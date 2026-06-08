export interface ScrapedProperty {
  source: 'zonaprop' | 'argenprob' | 'mercadolibre'
  externalId: string
  url: string
  title?: string
  price?: number
  currency?: 'USD' | 'ARS'
  address?: string
  neighborhood?: string
  m2Total?: number
  m2Covered?: number
  rooms?: number
  bathrooms?: number
  garages?: number
  expenses?: number
  photos: string[]
  description?: string
  propertyType?: 'casa' | 'ph'
  lat?: number
  lon?: number
  raw?: unknown
}

export interface ScrapeResult {
  source: string
  total: number      // propiedades encontradas en el sitio
  newCount: number   // propiedades nuevas guardadas
  updated: number    // propiedades que cambiaron de precio
  errors: number
}
