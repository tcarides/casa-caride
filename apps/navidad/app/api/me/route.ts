import { NextResponse } from 'next/server'
import { hasSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ loggedIn: await hasSession() })
}
