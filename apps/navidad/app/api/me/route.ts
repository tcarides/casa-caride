import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/identity'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await currentUser())
}
