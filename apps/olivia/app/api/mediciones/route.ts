import { NextRequest, NextResponse } from 'next/server'
import { getMediciones, addMedicion, deleteMedicion } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getMediciones())
}

export async function POST(req: NextRequest) {
  const b = await req.json() as { fecha?: string; tipo?: string; valor?: string; unidad?: string; notas?: string }
  if (!b.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) {
    return NextResponse.json({ error: 'fecha debe ser YYYY-MM-DD' }, { status: 400 })
  }
  if (!b.tipo?.trim() || !b.valor?.trim()) {
    return NextResponse.json({ error: 'tipo y valor requeridos' }, { status: 400 })
  }
  return NextResponse.json(await addMedicion({
    fecha: b.fecha,
    tipo: b.tipo.trim(),
    valor: b.valor.trim(),
    unidad: (b.unidad ?? '').trim(),
    notas: (b.notas ?? '').trim(),
  }))
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  await deleteMedicion(id)
  return NextResponse.json({ ok: true })
}
