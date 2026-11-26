import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@/lib/identity'
import {
  getSql,
  ensureSchema,
  getOrCreateMyList,
  accessibleLists,
  canAccessList,
  getListById,
  listShares,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/state?list=<id> → estado de una lista + las listas accesibles.
// Sin ?list → la lista propia del usuario (se crea la primera vez).
export async function GET(request: NextRequest) {
  await ensureSchema()
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'no autenticado' }, { status: 401 })

  const sql = getSql()
  const wanted = Number(request.nextUrl.searchParams.get('list'))

  // Resolver la lista a mostrar: la pedida (si tiene acceso) o la propia.
  let listId: number
  if (Number.isFinite(wanted) && wanted > 0 && (await canAccessList(wanted, user.email))) {
    listId = wanted
  } else {
    listId = (await getOrCreateMyList(user.email, user.name)).id
  }

  const [lists, listRow] = await Promise.all([accessibleLists(user.email), getListById(listId)])
  const mine = listRow?.ownerEmail === user.email.toLowerCase()
  const shares = mine ? await listShares(listId) : []

  const categories = await sql`
    SELECT id, name, position FROM categories
    WHERE list_id = ${listId}
    ORDER BY position ASC, name ASC
  `
  const items = await sql`
    SELECT id, name, category_id AS "categoryId", needed, checked, quantity, note
    FROM items
    WHERE list_id = ${listId}
    ORDER BY name ASC
  `

  return NextResponse.json(
    {
      list: listRow ? { ...listRow, mine } : null,
      lists,
      shares,
      categories,
      items,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
