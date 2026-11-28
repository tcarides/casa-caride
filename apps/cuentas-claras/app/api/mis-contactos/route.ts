import { NextRequest, NextResponse } from 'next/server'
import { requireReady } from '@/lib/guard'
import { getMisContactos } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ready = await requireReady(req)
  if ('res' in ready) return ready.res
  return NextResponse.json(await getMisContactos(ready.user.email))
}
