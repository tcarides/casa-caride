import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/view-as'

export const dynamic = 'force-dynamic'

/** Estado de "ver como" para la barra de las mini-apps. No es autoritativo. */
export async function GET() {
  const { viewing } = await getViewer()
  if (!viewing) return NextResponse.json({ viewing: null })
  return NextResponse.json(
    { viewing: { name: viewing.name, email: viewing.email } },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
