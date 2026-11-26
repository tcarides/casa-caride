import { NextRequest, NextResponse } from 'next/server'
import { requireListAccess } from '@/lib/guard'
import { getSql, ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface RawItem {
  name?: string
  needed?: boolean
  checked?: boolean
  quantity?: number
  note?: string
}
interface ImportGroup {
  name?: string
  items?: (string | RawItem)[]
}
interface ImportBody {
  listId?: number
  replace?: boolean
  categories?: ImportGroup[]
}

/**
 * POST /api/import
 * Body: {
 *   replace?: boolean,                       // si true, vacía catálogo antes
 *   categories: [                            // secciones en orden
 *     { name: string, items: (string | { name, needed? })[] }
 *   ]
 * }
 * Carga masiva del catálogo (pensado para importar desde AnyList).
 */
export async function POST(request: NextRequest) {
  await ensureSchema()
  const body = (await request.json().catch(() => ({}))) as ImportBody
  const gate = await requireListAccess(body.listId)
  if ('res' in gate) return gate.res
  const { listId } = gate

  const sql = getSql()
  const groups = Array.isArray(body.categories) ? body.categories : []

  if (body.replace) {
    await sql`DELETE FROM items WHERE list_id = ${listId}`
    await sql`DELETE FROM categories WHERE list_id = ${listId}`
  }

  let createdCategories = 0
  let createdItems = 0
  let position = 0
  const inserts: ReturnType<typeof sql>[] = []

  for (const group of groups) {
    const cname = (group?.name || '').trim().slice(0, 60)
    let categoryId: number | null = null

    if (cname) {
      const existing = await sql`
        SELECT id FROM categories WHERE name = ${cname} AND list_id = ${listId} LIMIT 1
      `
      if (existing.length) {
        categoryId = existing[0].id
      } else {
        const [row] = await sql`
          INSERT INTO categories (list_id, name, position)
          VALUES (${listId}, ${cname}, ${position})
          RETURNING id
        `
        categoryId = row.id
        createdCategories += 1
      }
    }
    position += 1

    const list = Array.isArray(group?.items) ? group.items : []
    for (const raw of list) {
      const name = (typeof raw === 'string' ? raw : raw?.name || '')
        .trim()
        .slice(0, 80)
      if (!name) continue
      const needed = typeof raw === 'object' && raw?.needed === true
      const checked = typeof raw === 'object' && raw?.checked === true
      const quantity =
        typeof raw === 'object'
          ? Math.max(1, Math.min(99, Number(raw?.quantity) || 1))
          : 1
      const note =
        typeof raw === 'object' ? (raw?.note || '').trim().slice(0, 200) || null : null
      inserts.push(
        sql`INSERT INTO items (list_id, name, category_id, needed, checked, quantity, note)
            VALUES (${listId}, ${name}, ${categoryId}, ${needed}, ${checked}, ${quantity}, ${note})`
      )
      createdItems += 1
    }
  }

  // Inserta todos los productos en una sola transacción (rápido aunque sean cientos).
  if (inserts.length) {
    await sql.transaction(inserts as Parameters<typeof sql.transaction>[0])
  }

  return NextResponse.json({
    categories: createdCategories,
    items: createdItems,
  })
}
