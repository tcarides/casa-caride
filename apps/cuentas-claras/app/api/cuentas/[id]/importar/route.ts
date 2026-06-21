import { NextRequest, NextResponse } from 'next/server'
import { grupoOwner, importarGrupo } from '@/lib/db'
import { currentEmail } from '@/lib/identity'

export const dynamic = 'force-dynamic'

// Importa los miembros de un grupo como participantes de la cuenta.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cuentaId = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as { grupoId?: number }
  const grupoId = Number(b.grupoId)
  if (!grupoId) return NextResponse.json({ error: 'grupoId requerido' }, { status: 400 })
  if ((await grupoOwner(grupoId)) !== (await currentEmail())) {
    return NextResponse.json({ error: 'sin acceso' }, { status: 403 })
  }
  const added = await importarGrupo(cuentaId, grupoId)
  return NextResponse.json({ added })
}
