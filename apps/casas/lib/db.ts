import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Property, PropertyStatus, UserId } from './types'

const DB_PATH = join(process.cwd(), 'data', 'properties.json')
const HAS_DB = !!process.env.DATABASE_URL || !!process.env.POSTGRES_URL

// Cache del JSON — evita re-leer en cada request
type RawProperty = Omit<Property, 'userStatus'> & { status?: PropertyStatus; notes?: string }
let _jsonCache: RawProperty[] | null = null
let _jsonCacheMtime = 0

function loadJson(): RawProperty[] {
  try {
    const { mtimeMs } = require('fs').statSync(DB_PATH)
    if (_jsonCache && mtimeMs === _jsonCacheMtime) return _jsonCache
    const raw = readFileSync(DB_PATH, 'utf-8')
    _jsonCache = JSON.parse(raw) as RawProperty[]
    _jsonCacheMtime = mtimeMs
    return _jsonCache
  } catch {
    return _jsonCache ?? []
  }
}

interface UserStateRow {
  property_id: string
  user_id: UserId
  status: PropertyStatus
}

interface NotesRow {
  property_id: string
  notes: string | null
  author_id: UserId | null
}

interface DiscontinuedRow {
  property_id: string
  discontinued_at: string
  marked_by: string | null
}

async function loadOverlays(): Promise<{
  states: Map<string, Partial<Record<UserId, PropertyStatus>>>
  notes: Map<string, { text: string; author?: UserId }>
  discontinued: Map<string, { at: string; by?: string }>
}> {
  if (!HAS_DB) return { states: new Map(), notes: new Map(), discontinued: new Map() }
  const { sql } = await import('@vercel/postgres')

  const [stateRes, notesRes, discRes] = await Promise.all([
    sql<UserStateRow>`SELECT property_id, user_id, status FROM property_user_state`,
    sql<NotesRow>`SELECT property_id, notes, author_id FROM property_notes WHERE notes IS NOT NULL`,
    sql<DiscontinuedRow>`SELECT property_id, discontinued_at, marked_by FROM property_discontinued`,
  ])

  const states = new Map<string, Partial<Record<UserId, PropertyStatus>>>()
  for (const r of stateRes.rows) {
    const cur = states.get(r.property_id) ?? {}
    cur[r.user_id] = r.status
    states.set(r.property_id, cur)
  }

  const notes = new Map<string, { text: string; author?: UserId }>()
  for (const r of notesRes.rows) {
    if (r.notes) notes.set(r.property_id, { text: r.notes, author: r.author_id ?? undefined })
  }

  const discontinued = new Map<string, { at: string; by?: string }>()
  for (const r of discRes.rows) {
    discontinued.set(r.property_id, { at: r.discontinued_at, by: r.marked_by ?? undefined })
  }

  return { states, notes, discontinued }
}

const DAY_MS = 86_400_000

// Score de completitud de info (para la pill "+ info" en grupos).
function completeness(p: RawProperty): number {
  let s = Math.min((p.photos?.length ?? 0), 12)
  for (const v of [p.m2Total, p.m2Covered, p.rooms, p.bathrooms, p.garages, p.address, p.description, p.title]) {
    if (v !== undefined && v !== null && v !== '') s += 2
  }
  return s
}

// Campos calculados al leer (no viven en el JSON): $/m² y días en el mercado.
function computeDerived(p: RawProperty): { pricePerM2?: number; daysOnMarket?: number } {
  const m2 = p.m2Total || p.m2Covered
  const pricePerM2 =
    typeof p.price === 'number' && p.price > 0 && m2 && m2 > 0 && p.currency !== 'ARS'
      ? Math.round(p.price / m2)
      : undefined
  const daysOnMarket = p.firstSeenAt
    ? Math.max(0, Math.floor((Date.now() - new Date(p.firstSeenAt).getTime()) / DAY_MS))
    : undefined
  return { pricePerM2, daysOnMarket }
}

export async function loadProperties(): Promise<Property[]> {
  const raw = loadJson()
  if (!HAS_DB) {
    return raw.map(p => ({
      ...p,
      userStatus: p.status ? { tomi: p.status } : {},
      ...computeDerived(p),
    }))
  }
  const { states, notes, discontinued } = await loadOverlays()
  const { loadGroupsByProperty } = await import('./dedupeDb')
  const groups: Map<string, { groupId: string; primaryId: string; members: string[] }> =
    await loadGroupsByProperty().catch(() => new Map())

  const propsById = new Map(raw.map(p => [p.id, p]))
  // Por grupo: id del miembro con más info (para la pill "+ info").
  const bestInfoByGroup = new Map<string, string>()
  for (const grp of new Set(groups.values())) {
    let bestId = grp.members[0], bestScore = -1
    for (const m of grp.members) {
      const mp = propsById.get(m)
      if (!mp) continue
      const sc = completeness(mp)
      if (sc > bestScore) { bestScore = sc; bestId = m }
    }
    bestInfoByGroup.set(grp.groupId, bestId)
  }

  return raw.map(p => {
    const note = notes.get(p.id)
    const disc = discontinued.get(p.id)
    const grp = groups.get(p.id)
    const siblings = grp
      ? grp.members.filter(m => m !== p.id).map(m => propsById.get(m)).filter(Boolean).map(m => ({ id: m!.id, source: m!.source, url: m!.url })) as { id: string; source: string; url: string }[]
      : undefined
    return {
      ...p,
      userStatus: states.get(p.id) ?? {},
      notes: note?.text ?? p.notes,
      notesAuthor: note?.author,
      discontinuedAt: disc?.at,
      discontinuedBy: disc?.by,
      groupId: grp?.groupId,
      isGroupPrimary: grp ? grp.primaryId === p.id : undefined,
      groupSiblings: siblings,
      groupBestInfoId: grp ? bestInfoByGroup.get(grp.groupId) : undefined,
      ...computeDerived(p),
    }
  })
}

export async function updateUserStatus(
  propertyId: string,
  userId: UserId,
  status: PropertyStatus
): Promise<Property | null> {
  if (HAS_DB) {
    const { sql } = await import('@vercel/postgres')
    await sql`
      INSERT INTO property_user_state (property_id, user_id, status, updated_at)
      VALUES (${propertyId}, ${userId}, ${status}, NOW())
      ON CONFLICT (property_id, user_id) DO UPDATE
        SET status = EXCLUDED.status, updated_at = NOW()
    `
    return getEnrichedProperty(propertyId)
  }

  // Fallback dev sin DB: escribe al JSON solo el status como antes
  const properties = loadJson()
  const idx = properties.findIndex(p => p.id === propertyId)
  if (idx === -1) return null
  properties[idx] = { ...properties[idx], status, updatedAt: new Date().toISOString() }
  properties.sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))
  writeFileSync(DB_PATH, JSON.stringify(properties, null, 2), 'utf-8')
  _jsonCache = null
  return { ...properties[idx], userStatus: { [userId]: status } }
}

export async function updateNotes(
  propertyId: string,
  notes: string,
  authorId: UserId
): Promise<Property | null> {
  if (HAS_DB) {
    const { sql } = await import('@vercel/postgres')
    await sql`
      INSERT INTO property_notes (property_id, notes, author_id, updated_at)
      VALUES (${propertyId}, ${notes}, ${authorId}, NOW())
      ON CONFLICT (property_id) DO UPDATE
        SET notes = EXCLUDED.notes, author_id = EXCLUDED.author_id, updated_at = NOW()
    `
    return getEnrichedProperty(propertyId)
  }

  // Fallback dev sin DB
  const properties = loadJson()
  const idx = properties.findIndex(p => p.id === propertyId)
  if (idx === -1) return null
  properties[idx] = { ...properties[idx], notes, updatedAt: new Date().toISOString() }
  writeFileSync(DB_PATH, JSON.stringify(properties, null, 2), 'utf-8')
  _jsonCache = null
  return {
    ...properties[idx],
    userStatus: properties[idx].status ? { tomi: properties[idx].status! } : {},
    notes,
    notesAuthor: authorId,
  }
}

async function getEnrichedProperty(propertyId: string): Promise<Property | null> {
  const base = loadJson().find(p => p.id === propertyId)
  if (!base) return null

  const { sql } = await import('@vercel/postgres')
  const [stateRes, notesRes, discRes] = await Promise.all([
    sql<UserStateRow>`SELECT user_id, status FROM property_user_state WHERE property_id = ${propertyId}`,
    sql<NotesRow>`SELECT notes, author_id FROM property_notes WHERE property_id = ${propertyId}`,
    sql<DiscontinuedRow>`SELECT discontinued_at, marked_by FROM property_discontinued WHERE property_id = ${propertyId}`,
  ])

  const userStatus: Partial<Record<UserId, PropertyStatus>> = {}
  for (const r of stateRes.rows) userStatus[r.user_id as UserId] = r.status

  const notesRow = notesRes.rows[0]
  const discRow = discRes.rows[0]
  return {
    ...base,
    userStatus,
    notes: notesRow?.notes ?? base.notes,
    notesAuthor: notesRow?.author_id ?? undefined,
    discontinuedAt: discRow?.discontinued_at,
    discontinuedBy: discRow?.marked_by ?? undefined,
  }
}

export async function setDiscontinued(
  propertyId: string,
  discontinued: boolean,
  markedBy: string
): Promise<Property | null> {
  if (HAS_DB) {
    const { sql } = await import('@vercel/postgres')
    if (discontinued) {
      await sql`
        INSERT INTO property_discontinued (property_id, discontinued_at, marked_by)
        VALUES (${propertyId}, NOW(), ${markedBy})
        ON CONFLICT (property_id) DO UPDATE
          SET discontinued_at = NOW(), marked_by = EXCLUDED.marked_by
      `
    } else {
      await sql`DELETE FROM property_discontinued WHERE property_id = ${propertyId}`
    }
    return getEnrichedProperty(propertyId)
  }

  // Fallback dev: la flag vive en memoria del cache, no se persiste sin DB
  return null
}
