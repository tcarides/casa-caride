import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { getTurnos, addTurno, deleteTurno } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  return NextResponse.json(await getTurnos())
}

export async function POST(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const b = await req.json() as { fecha?: string; profesional?: string; motivo?: string; notas?: string }
  if (!b.fecha) return NextResponse.json({ error: 'fecha requerida' }, { status: 400 })
  return NextResponse.json(await addTurno({
    fecha: b.fecha,
    profesional: (b.profesional ?? '').trim(),
    motivo: (b.motivo ?? '').trim(),
    notas: (b.notas ?? '').trim(),
  }))
}

export async function DELETE(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  await deleteTurno(id)
  return NextResponse.json({ ok: true })
}
