import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { loadProperties } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  const properties = await loadProperties()
  return NextResponse.json(properties)
}
