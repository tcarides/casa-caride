import { NextRequest, NextResponse } from 'next/server'
import { getDoses, setDose } from '@/lib/db'
import type { Slot, Caretaker } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const today = new Date().toISOString().slice(0, 10)
  const from = searchParams.get('from') ?? today
  const to   = searchParams.get('to')   ?? today
  const doses = await getDoses(from, to)
  return NextResponse.json(doses)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { date?: string; slot?: Slot; user?: Caretaker; given?: boolean }
  const { date, slot, user, given } = body

  if (!date || !slot || !user || given === undefined) {
    return NextResponse.json({ error: 'date, slot, user y given son requeridos' }, { status: 400 })
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
