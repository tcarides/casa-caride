/**
 * Helpers de DB para dedupe (candidatos, grupos, rechazados).
 */
import { sql } from '@vercel/postgres'
import { randomUUID } from 'crypto'

export interface DedupeCandidate {
  prop_a: string
  prop_b: string
  hamming: number
  same_address: boolean
  same_price_5pct: boolean
  same_m2_5pct: boolean
}

/**
 * Devuelve candidatos pendientes (no confirmados ni rechazados).
 * Excluye pares donde alguna ya está en un grupo distinto entre sí.
 */
export async function getPendingCandidates(limit = 50): Promise<DedupeCandidate[]> {
  const { rows } = await sql<DedupeCandidate>`
    SELECT c.prop_a, c.prop_b, c.hamming, c.same_address, c.same_price_5pct, c.same_m2_5pct
    FROM property_dedupe_candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM property_dedupe_rejected r
      WHERE (r.prop_a = c.prop_a AND r.prop_b = c.prop_b)
         OR (r.prop_a = c.prop_b AND r.prop_b = c.prop_a)
    )
    AND NOT EXISTS (
      -- ambas en el mismo grupo ya = no candidata
      SELECT 1
      FROM property_group_members ma
      JOIN property_group_members mb ON ma.group_id = mb.group_id
      WHERE ma.property_id = c.prop_a AND mb.property_id = c.prop_b
    )
    ORDER BY c.hamming ASC
    LIMIT ${limit}
  `
  return rows
}

export async function countPendingCandidates(): Promise<number> {
  const { rows } = await sql<{ count: string }>`
    SELECT COUNT(*)::TEXT AS count
    FROM property_dedupe_candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM property_dedupe_rejected r
      WHERE (r.prop_a = c.prop_a AND r.prop_b = c.prop_b)
         OR (r.prop_a = c.prop_b AND r.prop_b = c.prop_a)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM property_group_members ma
      JOIN property_group_members mb ON ma.group_id = mb.group_id
      WHERE ma.property_id = c.prop_a AND mb.property_id = c.prop_b
    )
  `
  return parseInt(rows[0]?.count ?? '0')
}

/**
 * Confirma que dos propiedades son la misma. Las une en un grupo:
 * - Si ninguna está en un grupo: crea uno nuevo
 * - Si una ya está en un grupo: agrega la otra al mismo grupo
 * - Si ambas están en grupos distintos: une los grupos en uno
 */
export async function confirmGroup(propA: string, propB: string): Promise<void> {
  // Buscar grupos existentes de cada una
  const { rows } = await sql<{ property_id: string; group_id: string }>`
    SELECT property_id, group_id FROM property_group_members
    WHERE property_id IN (${propA}, ${propB})
  `
  const ga = rows.find(r => r.property_id === propA)?.group_id
  const gb = rows.find(r => r.property_id === propB)?.group_id

  if (ga && gb && ga === gb) {
    // ya están en el mismo grupo, nada que hacer
    return
  }

  if (!ga && !gb) {
    // crear grupo nuevo con propA como primary
    const groupId = randomUUID()
    await sql`INSERT INTO property_groups (group_id, primary_id) VALUES (${groupId}, ${propA})`
    await sql`INSERT INTO property_group_members (property_id, group_id) VALUES (${propA}, ${groupId}), (${propB}, ${groupId})`
    return
  }

  if (ga && !gb) {
    await sql`INSERT INTO property_group_members (property_id, group_id) VALUES (${propB}, ${ga}) ON CONFLICT DO NOTHING`
    return
  }

  if (!ga && gb) {
    await sql`INSERT INTO property_group_members (property_id, group_id) VALUES (${propA}, ${gb}) ON CONFLICT DO NOTHING`
    return
  }

  // ambas en grupos distintos: mover todos los miembros de gb al grupo ga
  await sql`UPDATE property_group_members SET group_id = ${ga} WHERE group_id = ${gb}`
  await sql`DELETE FROM property_groups WHERE group_id = ${gb}`
}

export async function rejectPair(propA: string, propB: string): Promise<void> {
  const [a, b] = propA < propB ? [propA, propB] : [propB, propA]
  await sql`
    INSERT INTO property_dedupe_rejected (prop_a, prop_b)
    VALUES (${a}, ${b})
    ON CONFLICT (prop_a, prop_b) DO NOTHING
  `
}

interface GroupMembersRow {
  group_id: string
  primary_id: string
  property_id: string
}

/**
 * Devuelve un map: propertyId → { groupId, primaryId, members[] }
 * Para enriquecer las propiedades con info de grupo.
 */
export async function loadGroupsByProperty(): Promise<Map<string, { groupId: string; primaryId: string; members: string[] }>> {
  const { rows } = await sql<GroupMembersRow>`
    SELECT g.group_id, g.primary_id, m.property_id
    FROM property_groups g
    JOIN property_group_members m ON m.group_id = g.group_id
  `
  // group_id → members[]
  const groupMembers = new Map<string, string[]>()
  const groupPrimary = new Map<string, string>()
  for (const r of rows) {
    if (!groupMembers.has(r.group_id)) {
      groupMembers.set(r.group_id, [])
      groupPrimary.set(r.group_id, r.primary_id)
    }
    groupMembers.get(r.group_id)!.push(r.property_id)
  }

  const result = new Map<string, { groupId: string; primaryId: string; members: string[] }>()
  for (const [groupId, members] of groupMembers) {
    const primaryId = groupPrimary.get(groupId)!
    for (const propId of members) {
      result.set(propId, { groupId, primaryId, members })
    }
  }
  return result
}
