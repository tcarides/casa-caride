import { NextRequest, NextResponse } from 'next/server'
import { getConfig, setConfig } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getConfig())
}

export async function PUT(req: NextRequest) {
  const { dueDate, babyName } = await req.json() as { dueDate?: string; babyName?: string }
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json({ error: 'dueDate debe ser YYYY-MM-DD' }, { status: 400 })
  }
  const name = (babyName ?? '').trim() || 'Olivia'
  return NextResponse.json(await setConfig(dueDate, name))
}
