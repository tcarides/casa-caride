import { NextRequest, NextResponse } from 'next/server'
import { requireGrupo } from '@/lib/guard'
import { grantGrupoAccess, listAcceso, revokeGrupoAccess } from '@/lib/access'
import { fetchDirectory } from '@/lib/directory'

export const dynamic = 'force-dynamic'

/** Sumar a alguien a la lista (dueño o admin). No cambia ningún apodo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gate = await requireGrupo(req, Number(id), 'manage')
  if ('res' in gate) return gate.res
  const body = await req.json().catch(() => null)
  const email = String(body?.email ?? '').trim().toLowerCase()
  if (!email.includes('@')) return NextResponse.json({ error: 'email inválido' }, { status: 400 })
  const directory = await fetchDirectory(req.headers.get('cookie') ?? '')
  const known = directory?.find((u) => u.email.toLowerCase() === email)
  if (!known) return NextResponse.json({ error: 'ese usuario no está en Casa Caride' }, { status: 400 })
  await grantGrupoAccess(gate.grupoId, known.email, known.name, 'admin')
  return NextResponse.json({ acceso: await listAcceso(gate.grupoId) })
}

/** Sacar a alguien: pierde el acceso explícito, el vínculo de apodo y el rol de creador. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gate = await requireGrupo(req, Number(id), 'manage')
  if ('res' in gate) return gate.res
  const email = (req.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase()
  if (!email.includes('@')) return NextResponse.json({ error: 'email inválido' }, { status: 400 })
  await revokeGrupoAccess(gate.grupoId, email)
  return NextResponse.json({ acceso: await listAcceso(gate.grupoId) })
}
