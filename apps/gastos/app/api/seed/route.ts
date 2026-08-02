import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { createFijoIfMissing } from '@/lib/db'
import { SEED_FIJOS } from '@/lib/seed'

export const dynamic = 'force-dynamic'

/** Carga (una vez) los gastos fijos típicos de la casa. Idempotente: no duplica
 *  los que ya existen por nombre. Devuelve cuántos se agregaron. */
export async function POST() {
  const unauth = await requireSession()
  if (unauth) return unauth
  let agregados = 0
  for (const fijo of SEED_FIJOS) {
    if (await createFijoIfMissing(fijo)) agregados++
  }
  return NextResponse.json({ agregados, total: SEED_FIJOS.length })
}
