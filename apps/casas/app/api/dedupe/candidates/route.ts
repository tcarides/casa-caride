import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { getPendingCandidates, countPendingCandidates } from '@/lib/dedupeDb'
import { loadProperties } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  const [candidates, total, properties] = await Promise.all([
    getPendingCandidates(50),
    countPendingCandidates(),
    loadProperties(),
  ])

  // Enriquecer con datos de las propiedades
  const propMap = new Map(properties.map(p => [p.id, p]))
  const enriched = candidates.map(c => ({
    ...c,
    a: propMap.get(c.prop_a) ?? null,
    b: propMap.get(c.prop_b) ?? null,
  })).filter(c => c.a && c.b)

  return NextResponse.json({ candidates: enriched, total })
}
