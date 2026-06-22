import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { getSql, ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface CategoryPatch {
  name?: string
  position?: number
}

type Params = { params: Promise<{ id: string }> }

// PATCH /api/categories/:id  { name?, position? }
export async function PATCH(request: NextRequest, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  await ensureSchema()
  const sql = getSql()
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as CategoryPatch

  if (typeof body.name === 'string') {
    const name = body.name.trim().slice(0, 60)
    if (name) await sql`UPDATE categories SET name = ${name} WHERE id = ${id}`
  }
  if (typeof body.position === 'number') {
    await sql`UPDATE categories SET position = ${body.position} WHERE id = ${id}`
  }

  const [row] = await sql`SELECT id, name, position FROM categories WHERE id = ${id}`
  return NextResponse.json(row || {})
}

// DELETE /api/categories/:id  → borra la sección; sus productos quedan sin categoría
export async function DELETE(request: NextRequest, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  await ensureSchema()
  const sql = getSql()
  const { id } = await params
  await sql`UPDATE items SET category_id = NULL WHERE category_id = ${id}`
  await sql`DELETE FROM categories WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
