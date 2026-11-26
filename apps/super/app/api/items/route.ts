import { NextRequest, NextResponse } from 'next/server'
import { requireListAccess } from '@/lib/guard'
import { getSql, ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface ItemBody {
  listId?: number
  name?: string
  categoryId?: number | null
  needed?: boolean
  quantity?: number
  note?: string
}

// POST /api/items  { listId, name, categoryId?, needed? }  → agrega un producto
export async function POST(request: NextRequest) {
  await ensureSchema()
  const body = (await request.json().catch(() => ({}))) as ItemBody
  const gate = await requireListAccess(body.listId)
  if ('res' in gate) return gate.res
  const { listId } = gate

  const sql = getSql()
  const name = (body.name || '').trim().slice(0, 80)
  if (!name) {
    return NextResponse.json({ error: 'El nombre está vacío' }, { status: 400 })
  }
  const categoryId = body.categoryId ?? null
  const needed = body.needed === true
  const quantity = Math.max(1, Math.min(99, Number(body.quantity) || 1))
  const note = (body.note || '').trim().slice(0, 200) || null
  const [row] = await sql`
    INSERT INTO items (list_id, name, category_id, needed, quantity, note)
    VALUES (${listId}, ${name}, ${categoryId}, ${needed}, ${quantity}, ${note})
    RETURNING id, name, category_id AS "categoryId", needed, checked, quantity, note
  `
  return NextResponse.json(row, { status: 201 })
}
