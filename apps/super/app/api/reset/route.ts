import { NextRequest, NextResponse } from 'next/server'
import { requireListAccess } from '@/lib/guard'
import { getSql, ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/reset  { listId, scope: "trip" | "checked" }
//  - trip:    termina la compra → desmarca todo (needed=false, checked=false)
//  - checked: solo destilda lo comprado, manteniendo la lista
export async function POST(request: NextRequest) {
  await ensureSchema()
  const body = (await request.json().catch(() => ({}))) as { scope?: string; listId?: number }
  const gate = await requireListAccess(body.listId)
  if ('res' in gate) return gate.res
  const { listId } = gate

  const sql = getSql()
  const scope = body.scope === 'checked' ? 'checked' : 'trip'

  if (scope === 'checked') {
    await sql`UPDATE items SET checked = FALSE WHERE list_id = ${listId} AND checked = TRUE`
  } else {
    await sql`
      UPDATE items SET needed = FALSE, checked = FALSE
      WHERE list_id = ${listId} AND (needed = TRUE OR checked = TRUE)
    `
  }
  return NextResponse.json({ ok: true })
}
