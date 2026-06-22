import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { getDoses, setDose } from '@/lib/db'
import type { Slot, Caretaker } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const today = new Date().toISOString().slice(0, 10)
  const from = searchParams.get('from') ?? today
  const to   = searchParams.get('to')   ?? today
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (!isDate(from) || !isDate(to)) {
    return NextResponse.json({ error: 'from y to deben tener formato YYYY-MM-DD' }, { status: 400 })
  }
  const doses = await getDoses(from, to)
  return NextResponse.json(doses)
}

export async function POST(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const body = await req.json() as { date?: string; slot?: Slot; user?: Caretaker; given?: boolean }
  const { date, slot, user, given } = body

  if (!date || !slot || !user || given === undefined) {
    return NextResponse.json({ error: 'date, slot, user y given son requeridos' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date debe tener formato YYYY-MM-DD' }, { status: 400 })
  }
  if (slot !== 'am' && slot !== 'pm') {
    return NextResponse.json({ error: 'slot debe ser am o pm' }, { status: 400 })
  }
  if (user !== 'tomi' && user !== 'flori') {
    return NextResponse.json({ error: 'user debe ser tomi o flori' }, { status: 400 })
  }

  const dose = await setDose(date, slot, user, given)
  return NextResponse.json({ dose })
}
