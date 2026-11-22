import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { fetchPreview } from '@/lib/preview'

export const dynamic = 'force-dynamic'

/** Preview de un link de producto (Open Graph): imagen, título y precio. */
export async function GET(req: NextRequest) {
  const unauth = await requireSession()
  if (unauth) return unauth

  const url = req.nextUrl.searchParams.get('url') ?? ''
  if (!url) return NextResponse.json({ error: 'falta url' }, { status: 400 })

  const preview = await fetchPreview(url)
  if (!preview) return NextResponse.json({ ok: false, preview: null })
  return NextResponse.json({ ok: true, preview })
}
