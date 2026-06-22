import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { listGrupos, createGrupo } from '@/lib/db'
import { currentEmail } from '@/lib/identity'

export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  return NextResponse.json(await listGrupos(await currentEmail()))
}

export async function POST(req: NextRequest) {
  const denied = await requireSession()
  if (denied) return denied
  const b = (await req.json().catch(() => ({}))) as { name?: string }
  const name = (b.name ?? '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  const id = await createGrupo(await currentEmail(), name)
  return NextResponse.json({ id }, { status: 201 })
}
