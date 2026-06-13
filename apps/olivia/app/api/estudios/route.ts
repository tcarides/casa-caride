import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import { getEstudios, addEstudio, getEstudioUrl, deleteEstudio } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  return NextResponse.json(await getEstudios())
}

// Subida server-side: el archivo llega como multipart/form-data, lo mandamos al
// Blob store y guardamos la metadata. Más robusto que el client-upload detrás
// del rewrite del shell. Límite de payload de Vercel: ~4.5 MB por archivo.
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file')
  const fecha = String(form.get('fecha') ?? '')
  const titulo = String(form.get('titulo') ?? '').trim()
  const tipo = String(form.get('tipo') ?? 'otro')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'archivo requerido' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'fecha debe ser YYYY-MM-DD' }, { status: 400 })
  }
  if (!titulo) {
    return NextResponse.json({ error: 'título requerido' }, { status: 400 })
  }

  const blob = await put(file.name, file, { access: 'public', addRandomSuffix: true })
  const estudio = await addEstudio({
    fecha, titulo, tipo,
    blobUrl: blob.url, pathname: blob.pathname,
    contentType: file.type, size: file.size,
  })
  return NextResponse.json(estudio)
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const url = await getEstudioUrl(id)
  if (url) { try { await del(url) } catch { /* el archivo ya no existía */ } }
  await deleteEstudio(id)
  return NextResponse.json({ ok: true })
}
