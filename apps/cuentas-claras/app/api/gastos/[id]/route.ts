import { NextRequest, NextResponse } from 'next/server'
import { deleteGasto } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await deleteGasto(Number((await params).id))
  return NextResponse.json({ ok: true })
}
