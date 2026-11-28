import { ensureSchema, getSql } from './db'

export type Gate = 'missing' | 'none' | 'read' | 'manage'
export type Actor = { email: string; name: string; role: string }

async function memberOfCuenta(cuentaId: number, email: string): Promise<boolean> {
  const rows = await getSql()`
    SELECT 1
    WHERE EXISTS (SELECT 1 FROM participantes p WHERE p.cuenta_id = ${cuentaId} AND lower(p.user_email) = ${email})
       OR EXISTS (SELECT 1 FROM cuenta_acceso a WHERE a.cuenta_id = ${cuentaId} AND lower(a.email) = ${email})
    LIMIT 1
  `
  return rows.length > 0
}

async function memberOfGrupo(grupoId: number, email: string): Promise<boolean> {
  const rows = await getSql()`
    SELECT 1
    WHERE EXISTS (SELECT 1 FROM grupo_miembros m WHERE m.grupo_id = ${grupoId} AND lower(m.user_email) = ${email})
       OR EXISTS (SELECT 1 FROM grupo_acceso a WHERE a.grupo_id = ${grupoId} AND lower(a.email) = ${email})
    LIMIT 1
  `
  return rows.length > 0
}

function decide(owner: string | null, user: { email: string; role: string }, member: boolean): Gate {
  const e = user.email.toLowerCase()
  if (user.role === 'admin' || (owner && owner.toLowerCase() === e)) return 'manage'
  return member ? 'read' : 'none'
}

export async function cuentaGate(cuentaId: number, user: { email: string; role: string }): Promise<Gate> {
  await ensureSchema()
  const rows = await getSql()`SELECT owner_email FROM cuentas WHERE id = ${cuentaId}`
  if (!rows.length) return 'missing'
  const owner = (rows[0].owner_email as string | null) ?? null
  return decide(owner, user, await memberOfCuenta(cuentaId, user.email.toLowerCase()))
}

export async function grupoGate(grupoId: number, user: { email: string; role: string }): Promise<Gate> {
  await ensureSchema()
  const rows = await getSql()`SELECT owner_email FROM grupos WHERE id = ${grupoId}`
  if (!rows.length) return 'missing'
  const owner = (rows[0].owner_email as string | null) ?? null
  return decide(owner, user, await memberOfGrupo(grupoId, user.email.toLowerCase()))
}

export async function cuentaIdDeGasto(id: number): Promise<number | null> {
  await ensureSchema()
  const rows = await getSql()`SELECT cuenta_id FROM gastos WHERE id = ${id}`
  return rows.length ? Number(rows[0].cuenta_id) : null
}

export async function cuentaIdDeParticipante(id: number): Promise<number | null> {
  await ensureSchema()
  const rows = await getSql()`SELECT cuenta_id FROM participantes WHERE id = ${id}`
  return rows.length ? Number(rows[0].cuenta_id) : null
}

export async function cuentaIdDeLiquidacion(id: number): Promise<number | null> {
  await ensureSchema()
  const rows = await getSql()`SELECT cuenta_id FROM liquidaciones WHERE id = ${id}`
  return rows.length ? Number(rows[0].cuenta_id) : null
}

export async function grupoIdDeMiembro(id: number): Promise<number | null> {
  await ensureSchema()
  const rows = await getSql()`SELECT grupo_id FROM grupo_miembros WHERE id = ${id}`
  return rows.length ? Number(rows[0].grupo_id) : null
}

export async function grantCuentaAccess(cuentaId: number, email: string, name: string, origen: string): Promise<void> {
  await ensureSchema()
  const e = email.toLowerCase()
  await getSql()`
    INSERT INTO cuenta_acceso (cuenta_id, email, name, origen)
    VALUES (${cuentaId}, ${e}, ${name.trim() || e}, ${origen})
    ON CONFLICT (cuenta_id, email) DO NOTHING
  `
}

export async function grantGrupoAccess(grupoId: number, email: string, name: string, origen: string): Promise<void> {
  await ensureSchema()
  const e = email.toLowerCase()
  await getSql()`
    INSERT INTO grupo_acceso (grupo_id, email, name, origen)
    VALUES (${grupoId}, ${e}, ${name.trim() || e}, ${origen})
    ON CONFLICT (grupo_id, email) DO NOTHING
  `
}

export async function revokeCuentaAccess(cuentaId: number, email: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  const e = email.toLowerCase()
  await sql`DELETE FROM cuenta_acceso WHERE cuenta_id = ${cuentaId} AND lower(email) = ${e}`
  await sql`UPDATE participantes SET user_email = NULL WHERE cuenta_id = ${cuentaId} AND lower(user_email) = ${e}`
  await sql`UPDATE cuentas SET owner_email = NULL WHERE id = ${cuentaId} AND lower(owner_email) = ${e}`
}

export async function revokeGrupoAccess(grupoId: number, email: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  const e = email.toLowerCase()
  await sql`DELETE FROM grupo_acceso WHERE grupo_id = ${grupoId} AND lower(email) = ${e}`
  await sql`UPDATE grupo_miembros SET user_email = NULL WHERE grupo_id = ${grupoId} AND lower(user_email) = ${e}`
  await sql`UPDATE grupos SET owner_email = NULL WHERE id = ${grupoId} AND lower(owner_email) = ${e}`
}

export async function setParticipanteUser(id: number, email: string | null): Promise<void> {
  await ensureSchema()
  await getSql()`UPDATE participantes SET user_email = ${email} WHERE id = ${id}`
}

export async function listCuentaAcceso(cuentaId: number): Promise<{ email: string; name: string; origen: string }[]> {
  await ensureSchema()
  const rows = await getSql()`SELECT email, name, origen FROM cuenta_acceso WHERE cuenta_id = ${cuentaId} ORDER BY name`
  return rows.map((r) => ({ email: r.email as string, name: r.name as string, origen: r.origen as string }))
}

export async function listGrupoAcceso(grupoId: number): Promise<{ email: string; name: string; origen: string }[]> {
  await ensureSchema()
  const rows = await getSql()`SELECT email, name, origen FROM grupo_acceso WHERE grupo_id = ${grupoId} ORDER BY name`
  return rows.map((r) => ({ email: r.email as string, name: r.name as string, origen: r.origen as string }))
}

export async function findByToken(kind: 'cuenta' | 'grupo', token: string): Promise<{ id: number; name: string } | null> {
  if (!token) return null
  await ensureSchema()
  const rows = kind === 'cuenta'
    ? await getSql()`SELECT id, name FROM cuentas WHERE token = ${token}`
    : await getSql()`SELECT id, name FROM grupos WHERE token = ${token}`
  return rows.length ? { id: Number(rows[0].id), name: rows[0].name as string } : null
}
