import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { updateFijo, deleteFijo, setFijoActivo } from '@/lib/db'
import { parseFijo } from '@/lib/parse'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'body inválido' }, { status: 400 })

  // Alta/baja lógica sin tocar el resto de los campos.
  if (typeof body.activo === 'boolean' && Object.keys(body).length === 1) {
    await setFijoActivo(Number(id), body.activo)
    return NextResponse.json({ ok: true })
  }

  const parsed = parseFijo(body)
  if (!parsed) return NextResponse.json({ error: 'falta nombre' }, { status: 400 })
  await updateFijo(Number(id), parsed)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession()
  if (unauth) return unauth
  const { id } = await params
  await deleteFijo(Number(id))
  return NextResponse.json({ ok: true })
}
