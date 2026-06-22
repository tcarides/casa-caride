import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { getChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  return NextResponse.json(await getChecklist())
}

export async function POST(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const { text, tri } = await req.json() as { text?: string; tri?: string }
  if (!text?.trim()) return NextResponse.json({ error: 'text requerido' }, { status: 400 })
  return NextResponse.json(await addChecklistItem(text.trim(), (tri ?? '').trim()))
}

export async function PATCH(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const { id, done } = await req.json() as { id?: number; done?: boolean }
  if (typeof id !== 'number' || typeof done !== 'boolean') {
    return NextResponse.json({ error: 'id y done requeridos' }, { status: 400 })
  }
  await toggleChecklistItem(id, done)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  await deleteChecklistItem(id)
  return NextResponse.json({ ok: true })
}
