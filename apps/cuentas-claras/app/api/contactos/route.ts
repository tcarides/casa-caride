import { NextResponse } from 'next/server'
import { listContactos } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await listContactos())
}
