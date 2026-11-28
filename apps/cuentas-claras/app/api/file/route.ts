import { NextRequest, NextResponse } from 'next/server'
import { requireGasto } from '@/lib/guard'
import { get } from '@vercel/blob'
import { getGastoComprobante } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Sirve el comprobante privado por id de gasto, solo si podés ver esa cuenta.
export async function GET(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get('gasto'))
  if (!id) return NextResponse.json({ error: 'gasto requerido' }, { status: 400 })
  const gate = await requireGasto(req, id, 'read')
  if ('res' in gate) return gate.res
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
