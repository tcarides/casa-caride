import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { getSql, ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/state → todo el estado de la app en una sola consulta.
export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  await ensureSchema()
  const sql = getSql()
  const categories = await sql`
    SELECT id, name, position FROM categories
    ORDER BY position ASC, name ASC
  `
  const items = await sql`
    SELECT id, name, category_id AS "categoryId", needed, checked, quantity, note
    FROM items
    ORDER BY name ASC
  `
  return NextResponse.json(
    { categories, items },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
