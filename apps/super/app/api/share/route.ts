import { NextRequest, NextResponse } from 'next/server'
import { requireListOwner } from '@/lib/guard'
import { ensureSchema, addShare, removeShare, listShares } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/share?list=<id> → con quién está compartida (solo el dueño).
export async function GET(request: NextRequest) {
  await ensureSchema()
  const gate = await requireListOwner(Number(request.nextUrl.searchParams.get('list')))
  if ('res' in gate) return gate.res
  return NextResponse.json({ shares: await listShares(gate.listId) })
}

// POST /api/share  { listId, email, name }  → comparte con alguien (solo el dueño).
export async function POST(request: NextRequest) {
  await ensureSchema()
  const body = (await request.json().catch(() => ({}))) as {
    listId?: number
    email?: string
    name?: string
  }
  const gate = await requireListOwner(body.listId)
  if ('res' in gate) return gate.res

  const email = (body.email || '').trim().toLowerCase()
  const name = (body.name || '').trim().slice(0, 80) || email
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'email inválido' }, { status: 400 })
  }
  if (email === gate.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'esa lista ya es tuya' }, { status: 400 })
  }
  await addShare(gate.listId, email, name)
  return NextResponse.json({ shares: await listShares(gate.listId) }, { status: 201 })
}

// DELETE /api/share?list=<id>&email=<email>  → deja de compartir (solo el dueño).
export async function DELETE(request: NextRequest) {
  await ensureSchema()
  const gate = await requireListOwner(Number(request.nextUrl.searchParams.get('list')))
  if ('res' in gate) return gate.res
  const email = (request.nextUrl.searchParams.get('email') || '').trim().toLowerCase()
  if (email) await removeShare(gate.listId, email)
  return NextResponse.json({ shares: await listShares(gate.listId) })
}
