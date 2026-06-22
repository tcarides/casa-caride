import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createInvite } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Crea una invitación para sumar a un contacto. Pensado para ser llamado desde
// las zonas (ej. Cuentas Claras). El preset de apps se fuerza vacío: el invitado
// queda como 'member' y sólo ve las apps abiertas/públicas (Cuentas Claras es
// 'open'), nunca apps de permiso. Las invitaciones quedan visibles en /admin.
export async function POST(req: NextRequest) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'no autenticado' }, { status: 401 })

  const b = (await req.json().catch(() => ({}))) as { note?: string }
  const note = (b.note ?? '').trim().slice(0, 60) || 'Invitado/a'

  const token = await createInvite(note, [], email, 1, 14)
  const base = process.env.AUTH_URL ?? new URL(req.url).origin
  return NextResponse.json({ url: `${base}/invite/${token}`, token })
}
