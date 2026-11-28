import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from './identity'
import { ensureBackfill } from './backfill'
import {
  grupoGate,
  grupoIdDeDeseo,
  grupoIdDeOpcion,
  grupoIdDeParticipante,
  type Actor,
} from './access'

export type { Actor }

export async function requireReady(req: NextRequest): Promise<{ user: Actor } | { res: NextResponse }> {
  const user = await currentUser()
  if (!user) return { res: NextResponse.json({ error: 'no autenticado' }, { status: 401 }) }
  try {
    await ensureBackfill(req.headers.get('cookie') ?? '', user.role)
  } catch (err) {
    console.error('backfill navidad', err)
  }
  return { user }
}

export async function requireGrupo(
  req: NextRequest,
  grupoId: number,
  mode: 'read' | 'manage',
): Promise<{ user: Actor; grupoId: number; canManage: boolean } | { res: NextResponse }> {
  const ready = await requireReady(req)
  if ('res' in ready) return ready
  if (!Number.isFinite(grupoId)) {
    return { res: NextResponse.json({ error: 'falta grupo' }, { status: 400 }) }
  }
  const gate = await grupoGate(grupoId, ready.user)
  if (gate === 'missing') return { res: NextResponse.json({ error: 'no existe' }, { status: 404 }) }
  if (gate === 'none' || (mode === 'manage' && gate !== 'manage')) {
    return { res: NextResponse.json({ error: 'sin acceso' }, { status: 403 }) }
  }
  return { user: ready.user, grupoId, canManage: gate === 'manage' }
}

async function requireChild(
  req: NextRequest,
  id: number,
  lookup: (id: number) => Promise<number | null>,
  mode: 'read' | 'manage',
): Promise<{ user: Actor; grupoId: number } | { res: NextResponse }> {
  const ready = await requireReady(req)
  if ('res' in ready) return ready
  if (!Number.isFinite(id)) return { res: NextResponse.json({ error: 'id inválido' }, { status: 400 }) }
  const grupoId = await lookup(id)
  if (grupoId == null) return { res: NextResponse.json({ error: 'no existe' }, { status: 404 }) }
  const gate = await grupoGate(grupoId, ready.user)
  if (gate === 'missing') return { res: NextResponse.json({ error: 'no existe' }, { status: 404 }) }
  if (gate === 'none' || (mode === 'manage' && gate !== 'manage')) {
    return { res: NextResponse.json({ error: 'sin acceso' }, { status: 403 }) }
  }
  return { user: ready.user, grupoId }
}

export function requireParticipante(req: NextRequest, id: number, mode: 'read' | 'manage') {
  return requireChild(req, id, grupoIdDeParticipante, mode)
}

export function requireDeseo(req: NextRequest, id: number, mode: 'read' | 'manage') {
  return requireChild(req, id, grupoIdDeDeseo, mode)
}

export function requireOpcion(req: NextRequest, id: number, mode: 'read' | 'manage') {
  return requireChild(req, id, grupoIdDeOpcion, mode)
}
