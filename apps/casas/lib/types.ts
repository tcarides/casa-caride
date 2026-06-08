export type PropertyStatus = 'unseen' | 'seen' | 'maybe' | 'favorite' | 'discarded'

export type UserId = 'tomi' | 'flori'
export const USERS: UserId[] = ['tomi', 'flori']
export const USER_LABELS: Record<UserId, string> = { tomi: 'Tomi', flori: 'Flori' }

export interface Property {
  id: string
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
  lat?: number
  lon?: number
  geocoded?: 'ml' | 'nominatim' | 'failed'
  // Status per-usuario. Si un usuario no tiene registro, se considera 'unseen'.
  userStatus: Partial<Record<UserId, PropertyStatus>>
  notes?: string             // compartidas (un solo texto por propiedad)
  notesAuthor?: UserId       // último que editó las notas
  discontinuedAt?: string    // ISO timestamp si fue marcada como "no publicada"
  discontinuedBy?: string    // user_id o 'cleanup'
  // Dedupe: si pertenece a un grupo, info de quién es el primary y los otros miembros
  groupId?: string
  isGroupPrimary?: boolean
  groupSiblings?: { id: string; source: string; url: string }[]
  groupBestInfoId?: string   // id del miembro del grupo con más info (para la pill "+ info")
  // Historial de precios (1 punto por cambio). Habilita "bajó de precio" y tendencias.
  priceHistory?: { date: string; price: number; currency?: string }[]
  // Campos calculados al leer (no se guardan en el JSON):
  pricePerM2?: number        // price / (m2Total || m2Covered)
  daysOnMarket?: number      // días desde firstSeenAt
  firstSeenAt: string
  updatedAt: string
}

export interface Filters {
  zona: string[]
  tipo: string[]
  source: string[]
  // Status del USUARIO ACTUAL
  status: PropertyStatus[]
  // Filtro especial: solo casas que ambos usuarios marcaron como favorite
  favBoth: boolean
  // Filtrado de no publicadas: 'show' (default), 'hide' (oculta), 'only' (solo no publicadas)
  discontinued: 'show' | 'hide' | 'only'
  // Si true, oculta las propiedades agrupadas que no son la "primary" de su grupo
  hideDuplicates: boolean
  priceMin: string
  priceMax: string
  m2Min: string
  m2Max: string
  roomsMin: string
  search: string
}
