import { NextRequest, NextResponse } from 'next/server'
import { currentEmail } from '@/lib/identity'
import { linkContacto } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Asocia un email a un contacto en mis grupos, para que al entrar con ese email
// la persona quede identificada con su contacto. El link de invitación en sí lo
// crea el shell (POST /api/invite); acá sólo dejamos preparado el vínculo.
export async function POST(req: NextRequest) {
  const email = await currentEmail()
  if (!email) return NextResponse.json({ error: 'no autenticado' }, { status: 401 })
  const b = (await req.json().catch(() => ({}))) as { name?: string; email?: string }
  const name = (b.name ?? '').trim().slice(0, 60)
  const contactEmail = (b.email ?? '').trim().toLowerCase().slice(0, 200)
  if (!name || !contactEmail || !contactEmail.includes('@')) {
    return NextResponse.json({ error: 'nombre y email válidos requeridos' }, { status: 400 })
  }
  const linked = await linkContacto(email, name, contactEmail)
  return NextResponse.json({ ok: true, linked })
}
