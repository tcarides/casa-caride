import { NextRequest, NextResponse } from 'next/server'
import { requireReady } from '@/lib/guard'
import { linkContacto } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Asocia un email a un contacto en mis grupos. El link de invitación lo crea
// el shell; acá queda el vínculo para que, al entrar, vea esos grupos.
export async function POST(req: NextRequest) {
  const ready = await requireReady(req)
  if ('res' in ready) return ready.res
  const b = (await req.json().catch(() => ({}))) as { name?: string; email?: string }
  const name = (b.name ?? '').trim().slice(0, 60)
  const contactEmail = (b.email ?? '').trim().toLowerCase().slice(0, 200)
  if (!name || !contactEmail || !contactEmail.includes('@')) {
    return NextResponse.json({ error: 'nombre y email válidos requeridos' }, { status: 400 })
  }
  const linked = await linkContacto(ready.user.email, name, contactEmail)
  return NextResponse.json({ ok: true, linked })
}
