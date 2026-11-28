import { NextResponse } from 'next/server'
import { listJoinHints, listUsers } from '@/lib/db'
import { getViewer } from '@/lib/view-as'

export const dynamic = 'force-dynamic'

// Lo usa el backfill de las zonas. Solo el admin real (aunque esté "viendo como"
// alguien, la cookie de sesión sigue siendo la de él).
export async function GET() {
  const { real } = await getViewer()
  if (real?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const [users, hints] = await Promise.all([listUsers(), listJoinHints()])
  return NextResponse.json({
    users: users.map((u) => ({ name: u.name, email: u.email, role: u.role })),
    hints,
  })
}
