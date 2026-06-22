import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { listContactos } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  return NextResponse.json(await listContactos())
}
