export type PropertySource = 'zonaprop' | 'argenprob' | 'mercadolibre'
export type Currency = 'USD' | 'ARS'
export type PropertyStatus = 'unseen' | 'seen' | 'favorite' | 'discarded'

export interface Property {
  id: string                  // generated: source + externalId
  source: PropertySource
  externalId: string
  url: string
  title: string
  price: number
  currency: Currency
  address: string
  neighborhood?: string
  m2Total?: number
  m2Covered?: number
  rooms?: number
  bathrooms?: number
  garages?: number
  expenses?: number
  photos: string[]
  description?: string
  status: PropertyStatus
  notes?: string
  savedAt: string             // ISO date
  updatedAt: string           // ISO date
}

// Lo que extrae cada content script — sin campos de gestión
export type ExtractedData = Omit<Property,
  'id' | 'status' | 'notes' | 'savedAt' | 'updatedAt'
>

// Mensajes entre content script ↔ popup ↔ background
export type Message =
  | { type: 'PROPERTY_EXTRACTED'; data: ExtractedData }
  | { type: 'GET_CURRENT_PROPERTY' }
  | { type: 'SAVE_PROPERTY'; data: ExtractedData; notes?: string }
  | { type: 'UPDATE_STATUS'; id: string; status: PropertyStatus }
  | { type: 'DELETE_PROPERTY'; id: string }
  | { type: 'GET_ALL_PROPERTIES' }

export type MessageResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string }
