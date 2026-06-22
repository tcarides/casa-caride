import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { get } from '@vercel/blob'
import { getGastoComprobante } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Sirve el comprobante privado por id de gasto (el pathname sale de la DB, así
// no exponemos un proxy abierto al store).
export async function GET(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number(new URL(req.url).searchParams.get('gasto'))
  if (!id) return NextResponse.json({ error: 'gasto requerido' }, { status: 400 })
  const pathname = await getGastoComprobante(id)
  if (!pathname) return NextResponse.json({ error: 'sin comprobante' }, { status: 404 })

  const result = await get(pathname, { access: 'private' })
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: 'no disponible' }, { status: 404 })
  }
  return new Response(result.stream, {
    headers: {
      'content-type': result.blob.contentType || 'application/octet-stream',
      'content-disposition': 'inline',
      'cache-control': 'private, max-age=3600',
    },
  })
}
