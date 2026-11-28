import { NextRequest, NextResponse } from 'next/server'
import { requireReady } from '@/lib/guard'
import { fetchPreview } from '@/lib/preview'

export const dynamic = 'force-dynamic'

/** Preview de un link de producto (Open Graph): imagen, título y precio. */
export async function GET(req: NextRequest) {
  const ready = await requireReady(req)
  if ('res' in ready) return ready.res

  const url = req.nextUrl.searchParams.get('url') ?? ''
  if (!url) return NextResponse.json({ error: 'falta url' }, { status: 400 })

  const preview = await fetchPreview(url)
  if (!preview) return NextResponse.json({ ok: false, preview: null })
  return NextResponse.json({ ok: true, preview })
}
