import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { get } from '@vercel/blob'
import { getEstudioBlob } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Sirve un estudio privado: descarga el blob autenticado (con el token del
// servidor) y lo devuelve al cliente. Así los archivos médicos no quedan en
// una URL pública.
export async function GET(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const e = await getEstudioBlob(id)
  if (!e) return NextResponse.json({ error: 'no encontrado' }, { status: 404 })

  const result = await get(e.pathname, { access: 'private' })
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: 'archivo no disponible' }, { status: 404 })
  }
  return new Response(result.stream, {
    headers: {
      'content-type': e.contentType || result.blob.contentType || 'application/octet-stream',
      'content-disposition': 'inline',
      'cache-control': 'private, max-age=3600',
    },
  })
}
