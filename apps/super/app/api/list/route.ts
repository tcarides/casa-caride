import { NextRequest, NextResponse } from 'next/server'
import { requireListOwner } from '@/lib/guard'
import { ensureSchema, renameList, getListById } from '@/lib/db'

export const dynamic = 'force-dynamic'

// PATCH /api/list  { listId, name }  → renombra la lista propia (solo el dueño).
export async function PATCH(request: NextRequest) {
  await ensureSchema()
  const body = (await request.json().catch(() => ({}))) as { listId?: number; name?: string }
  const gate = await requireListOwner(body.listId)
  if ('res' in gate) return gate.res

  const name = (body.name || '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'El nombre está vacío' }, { status: 400 })
  await renameList(gate.listId, name)
  const row = await getListById(gate.listId)
  return NextResponse.json(row ? { ...row, mine: true } : {})
}
