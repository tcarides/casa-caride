import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from './identity'
import { ensureBackfill } from './backfill'
import {
  cuentaGate,
  cuentaIdDeGasto,
  cuentaIdDeLiquidacion,
  cuentaIdDeParticipante,
  grupoGate,
  grupoIdDeMiembro,
  type Actor,
  type Gate,
} from './access'

export type { Actor }

export async function requireReady(req: NextRequest): Promise<{ user: Actor } | { res: NextResponse }> {
  const user = await currentUser()
  if (!user) return { res: NextResponse.json({ error: 'no autenticado' }, { status: 401 }) }
  try {
    await ensureBackfill(req.headers.get('cookie') ?? '', user.role)
  } catch (err) {
    console.error('backfill cuentas', err)
  }
  return { user }
}

async function requireResource(
  req: NextRequest,
  id: number,
  gateOf: (id: number, user: Actor) => Promise<Gate>,
  mode: 'read' | 'manage',
): Promise<{ user: Actor; id: number; canManage: boolean } | { res: NextResponse }> {
  const ready = await requireReady(req)
  if ('res' in ready) return ready
  if (!Number.isFinite(id)) return { res: NextResponse.json({ error: 'id inválido' }, { status: 400 }) }
  const gate = await gateOf(id, ready.user)
  if (gate === 'missing') return { res: NextResponse.json({ error: 'no existe' }, { status: 404 }) }
  if (gate === 'none' || (mode === 'manage' && gate !== 'manage')) {
    return { res: NextResponse.json({ error: 'sin acceso' }, { status: 403 }) }
  }
  return { user: ready.user, id, canManage: gate === 'manage' }
}

export function requireCuenta(req: NextRequest, id: number, mode: 'read' | 'manage' = 'read') {
  return requireResource(req, id, cuentaGate, mode)
}

export function requireGrupo(req: NextRequest, id: number, mode: 'read' | 'manage' = 'read') {
  return requireResource(req, id, grupoGate, mode)
}

async function requireChild(
  req: NextRequest,
  childId: number,
  lookup: (id: number) => Promise<number | null>,
  gateOf: (id: number, user: Actor) => Promise<Gate>,
  mode: 'read' | 'manage',
): Promise<{ user: Actor; parentId: number; canManage: boolean } | { res: NextResponse }> {
  const ready = await requireReady(req)
  if ('res' in ready) return ready
  if (!Number.isFinite(childId)) return { res: NextResponse.json({ error: 'id inválido' }, { status: 400 }) }
  const parentId = await lookup(childId)
  if (parentId == null) return { res: NextResponse.json({ error: 'no existe' }, { status: 404 }) }
  const gate = await gateOf(parentId, ready.user)
  if (gate === 'missing') return { res: NextResponse.json({ error: 'no existe' }, { status: 404 }) }
  if (gate === 'none' || (mode === 'manage' && gate !== 'manage')) {
    return { res: NextResponse.json({ error: 'sin acceso' }, { status: 403 }) }
  }
  return { user: ready.user, parentId, canManage: gate === 'manage' }
}

export function requireGasto(req: NextRequest, id: number, mode: 'read' | 'manage' = 'read') {
  return requireChild(req, id, cuentaIdDeGasto, cuentaGate, mode)
}

export function requireParticipanteCuenta(req: NextRequest, id: number, mode: 'read' | 'manage' = 'read') {
  return requireChild(req, id, cuentaIdDeParticipante, cuentaGate, mode)
}

export function requireLiquidacion(req: NextRequest, id: number, mode: 'read' | 'manage' = 'read') {
  return requireChild(req, id, cuentaIdDeLiquidacion, cuentaGate, mode)
}

export function requireMiembro(req: NextRequest, id: number, mode: 'read' | 'manage' = 'read') {
  return requireChild(req, id, grupoIdDeMiembro, grupoGate, mode)
}
