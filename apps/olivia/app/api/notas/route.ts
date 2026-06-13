import { NextRequest, NextResponse } from 'next/server'
import { getNotas, addNota, deleteNota } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getNotas())
}

export async function POST(req: NextRequest) {
  const b = await req.json() as { fecha?: string; categoria?: string; texto?: string }
  if (!b.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) {
    return NextResponse.json({ error: 'fecha debe ser YYYY-MM-DD' }, { status: 400 })
  }
  if (!b.texto?.trim()) return NextResponse.json({ error: 'texto requerido' }, { status: 400 })
  return NextResponse.json(await addNota({
    fecha: b.fecha,
    categoria: (b.categoria ?? 'nota').trim(),
    texto: b.texto.trim(),
  }))
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  await deleteNota(id)
  return NextResponse.json({ ok: true })
}
