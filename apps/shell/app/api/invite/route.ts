import { NextRequest, NextResponse } from 'next/server'
import { readonlyBody } from '@casa/view-as'
import { createInvite } from '@/lib/db'
import { getViewer } from '@/lib/view-as'

export const dynamic = 'force-dynamic'

// Crea una invitación para sumar a un contacto. Pensado para ser llamado desde
// las zonas (ej. Cuentas Claras). El preset que manda la zona va vacío: el
// invitado queda como 'member' con las apps abiertas (súper, cuentas, navidad),
// nunca con apps de permiso. Las invitaciones quedan visibles en /admin.
export async function POST(req: NextRequest) {
  const { real, viewing } = await getViewer()
  if (viewing) return NextResponse.json(readonlyBody(viewing.name), { status: 403 })
  const email = real?.email
  if (!email) return NextResponse.json({ error: 'no autenticado' }, { status: 401 })

  const b = (await req.json().catch(() => ({}))) as { note?: string }
  const note = (b.note ?? '').trim().slice(0, 60) || 'Invitado/a'

  const token = await createInvite(note, [], email, 1, 14)
  const base = process.env.AUTH_URL ?? new URL(req.url).origin
  return NextResponse.json({ url: `${base}/invite/${token}`, token })
}
