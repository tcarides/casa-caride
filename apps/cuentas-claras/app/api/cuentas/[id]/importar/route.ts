import { NextRequest, NextResponse } from 'next/server'
import { requireCuenta, requireGrupo } from '@/lib/guard'
import { importarGrupo } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Importa los miembros de un grupo como participantes de la cuenta.
// Hay que poder ver las dos cosas.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cuentaId = Number((await params).id)
  const b = (await req.json().catch(() => ({}))) as { grupoId?: number }
  const grupoId = Number(b.grupoId)
  const cuenta = await requireCuenta(req, cuentaId, 'read')
  if ('res' in cuenta) return cuenta.res
  const grupo = await requireGrupo(req, grupoId, 'read')
  if ('res' in grupo) return grupo.res
  const added = await importarGrupo(cuentaId, grupoId)
  return NextResponse.json({ added })
}
