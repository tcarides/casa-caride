import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { del } from '@vercel/blob'
import { getEstudios, addEstudio, getEstudioUrl, deleteEstudio } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  return NextResponse.json(await getEstudios())
}

// Guarda la metadata después de que el navegador subió el archivo al Blob
// (client-upload vía /api/estudios/upload).
export async function POST(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const b = await req.json() as {
    fecha?: string; titulo?: string; tipo?: string
    blobUrl?: string; pathname?: string; contentType?: string; size?: number
  }
  if (!b.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) {
    return NextResponse.json({ error: 'fecha debe ser YYYY-MM-DD' }, { status: 400 })
  }
  if (!b.titulo?.trim() || !b.blobUrl || !b.pathname) {
    return NextResponse.json({ error: 'titulo, blobUrl y pathname requeridos' }, { status: 400 })
  }
  const estudio = await addEstudio({
    fecha: b.fecha,
    titulo: b.titulo.trim(),
    tipo: b.tipo ?? 'otro',
    blobUrl: b.blobUrl,
    pathname: b.pathname,
    contentType: b.contentType ?? '',
    size: b.size ?? 0,
  })
  return NextResponse.json(estudio)
}

export async function DELETE(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const url = await getEstudioUrl(id)
  if (url) { try { await del(url) } catch { /* el archivo ya no existía */ } }
  await deleteEstudio(id)
  return NextResponse.json({ ok: true })
}
