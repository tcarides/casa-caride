/**
 * Store de propiedades usando un archivo JSON local.
 * Sin dependencias nativas — suficiente para uso personal.
 *
 * Archivo: data/properties.json
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// JSON vive en apps/casas/data/ para que sea bundleable por Next/Vercel
export const DB_PATH = join(__dirname, '..', '..', '..', 'apps', 'casas', 'data', 'properties.json')

mkdirSync(dirname(DB_PATH), { recursive: true })

export interface Property {
  id: string           // "zonaprop:12345678"
  source: string
  externalId: string
  url: string
  title?: string
  price?: number
  currency?: string
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
  propertyType?: string
  status: 'unseen' | 'seen' | 'favorite' | 'discarded'
  notes?: string
  phash?: string  // perceptual hash de la primera foto (16 chars hex = 64 bits dHash)
  lat?: number
  lon?: number
  geocoded?: 'ml' | 'nominatim' | 'failed'  // origen del lat/lon
  priceHistory?: { date: string; price: number; currency?: string }[]  // se apila en cada cambio de precio
  firstSeenAt: string
  updatedAt: string
}

// Cache en memoria — cargamos una sola vez por ejecución
let _cache: Map<string, Property> | null = null

function load(): Map<string, Property> {
  if (_cache) return _cache
  if (!existsSync(DB_PATH)) {
    _cache = new Map()
    return _cache
  }
  try {
    const arr = JSON.parse(readFileSync(DB_PATH, 'utf-8')) as Property[]
    _cache = new Map(arr.map(p => [p.id, p]))
  } catch {
    _cache = new Map()
  }
  return _cache
}

function sleepSync(ms: number) {
  const end = Date.now() + ms
  while (Date.now() < end) { /* busy-wait corto: persist es sync */ }
}

function persist(map: Map<string, Property>) {
  const arr = Array.from(map.values())
  arr.sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))
  const json = JSON.stringify(arr, null, 2)
  // Escritura atómica (temp + rename) con reintento: en Windows el antivirus
  // a veces lockea el archivo y writeFileSync tira UNKNOWN (errno -4094).
  const tmp = `${DB_PATH}.tmp`
  let lastErr: unknown
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      writeFileSync(tmp, json, 'utf-8')
      renameSync(tmp, DB_PATH)
      return
    } catch (err) {
      lastErr = err
      sleepSync(150)
    }
  }
  throw lastErr
}

export interface UpsertResult {
  isNew: boolean
  priceChanged: boolean
  oldPrice?: number
}

export function upsertProperty(data: Omit<Property, 'status' | 'firstSeenAt' | 'updatedAt'>): UpsertResult {
  const store = load()
  const now = new Date().toISOString()
  const existing = store.get(data.id)

  if (!existing) {
    const priceHistory = data.price !== undefined
      ? [{ date: now, price: data.price, currency: data.currency }]
      : undefined
    store.set(data.id, { ...data, priceHistory, status: 'unseen', firstSeenAt: now, updatedAt: now })
    persist(store) // nuevas se persisten ya (durabilidad ante un corte)
    return { isNew: true, priceChanged: false }
  }

  // Existe: actualizar datos de mercado, preservar status/notes del usuario
  const priceChanged = existing.price !== undefined && data.price !== undefined && existing.price !== data.price
  const oldPrice = existing.price

  // Historial de precios: preservar lo que había y apilar el nuevo punto si cambió.
  let priceHistory = existing.priceHistory ?? (existing.price !== undefined ? [{ date: existing.firstSeenAt, price: existing.price, currency: existing.currency }] : [])
  if (priceChanged && data.price !== undefined) {
    priceHistory = [...priceHistory, { date: now, price: data.price, currency: data.currency }]
  }

  store.set(data.id, {
    ...data,
    status: existing.status,
    notes: existing.notes,
    phash: existing.phash,
    priceHistory,
    // lat/lon: preservar lo geocodificado, pero permitir que el scraper sobreescriba si trae coords
    lat: data.lat ?? existing.lat,
    lon: data.lon ?? existing.lon,
    geocoded: data.lat ? 'ml' : existing.geocoded,
    firstSeenAt: existing.firstSeenAt,
    updatedAt: now,
  })
  // Solo persistimos al instante si cambió el precio. Las re-confirmaciones sin
  // cambio (la mayoría en pasadas por barrio+precio) quedan en cache y se vuelcan
  // con flush() al final, evitando reescribir el JSON entero miles de veces.
  if (priceChanged) persist(store)
  return { isNew: false, priceChanged, oldPrice }
}

/** Vuelca a disco el estado en memoria. Llamar al final del scrape. */
export function flush(): void {
  if (_cache) persist(_cache)
}

export function getExistingIds(source: string): Set<string> {
  const store = load()
  const ids = new Set<string>()
  for (const p of store.values()) {
    if (p.source === source) ids.add(p.id)
  }
  return ids
}

export function getAllProperties(): Property[] {
  return Array.from(load().values())
}
