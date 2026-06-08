import { NextResponse } from 'next/server'
import { loadProperties } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const properties = await loadProperties()
  return NextResponse.json(properties)
}
