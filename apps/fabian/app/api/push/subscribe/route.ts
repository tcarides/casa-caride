import { NextRequest, NextResponse } from 'next/server'
import { saveSub, deleteSub } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { subscription, userId } = await req.json() as {
    subscription: { endpoint: string; keys?: { auth?: string; p256dh?: string } }
    userId: string
  }
  if (!subscription?.endpoint || !userId) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  await saveSub(subscription, userId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json() as { endpoint: string }
  if (!endpoint) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  await deleteSub(endpoint)
  return NextResponse.json({ ok: true })
}
