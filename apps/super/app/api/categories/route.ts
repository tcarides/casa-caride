import { NextRequest, NextResponse } from 'next/server'
import { requireListAccess } from '@/lib/guard'
import { getSql, ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/categories  { listId, name }  → crea una sección en esa lista
export async function POST(request: NextRequest) {
  await ensureSchema()
  const body = (await request.json().catch(() => ({}))) as { name?: string; listId?: number }
  const gate = await requireListAccess(body.listId)
  if ('res' in gate) return gate.res
  const { listId } = gate

  const sql = getSql()
  const name = (body.name || '').trim().slice(0, 60)
  if (!name) {
    return NextResponse.json({ error: 'El nombre está vacío' }, { status: 400 })
  }
  const [{ max }] = await sql`
    SELECT COALESCE(MAX(position), 0) AS max FROM categories WHERE list_id = ${listId}
  `
  const [row] = await sql`
    INSERT INTO categories (list_id, name, position)
    VALUES (${listId}, ${name}, ${Number(max) + 1})
    RETURNING id, name, position
  `
  return NextResponse.json(row, { status: 201 })
}
