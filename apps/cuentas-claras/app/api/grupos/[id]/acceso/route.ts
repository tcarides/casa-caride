import { NextRequest, NextResponse } from 'next/server'
import { requireGrupo } from '@/lib/guard'
import { grantGrupoAccess, listGrupoAcceso, revokeGrupoAccess } from '@/lib/access'
import { fetchDirectory } from '@/lib/directory'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const gate = await requireGrupo(req, id, 'manage')
  if ('res' in gate) return gate.res
  const body = await req.json().catch(() => null) as { email?: string }
  const email = (body?.email ?? '').trim().toLowerCase()
  if (!email.includes('@')) return NextResponse.json({ error: 'email inválido' }, { status: 400 })
  const directory = await fetchDirectory(req.headers.get('cookie') ?? '')
  const known = directory?.find((u) => u.email.toLowerCase() === email)
  if (!known) return NextResponse.json({ error: 'ese usuario no está en Casa Caride' }, { status: 400 })
  await grantGrupoAccess(id, known.email, known.name, 'admin')
  return NextResponse.json({ acceso: await listGrupoAcceso(id) })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const gate = await requireGrupo(req, id, 'manage')
  if ('res' in gate) return gate.res
  const email = (req.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase()
  if (!email.includes('@')) return NextResponse.json({ error: 'email inválido' }, { status: 400 })
  await revokeGrupoAccess(id, email)
  return NextResponse.json({ acceso: await listGrupoAcceso(id) })
}
