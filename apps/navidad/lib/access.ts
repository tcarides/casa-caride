import { getSql, ensureSchema } from './db'

export type Gate = 'missing' | 'none' | 'read' | 'manage'
export type Actor = { email: string; name: string; role: string }

export async function grupoGate(grupoId: number, user: { email: string; role: string }): Promise<Gate> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT owner_email FROM grupos WHERE id = ${grupoId}`
  if (!rows.length) return 'missing'
  const owner = (rows[0].owner_email as string | null) ?? null
  const e = user.email.toLowerCase()
  if (user.role === 'admin' || (owner && owner.toLowerCase() === e)) return 'manage'
  const member = await sql`
    SELECT 1
    WHERE EXISTS (SELECT 1 FROM grupo_acceso a WHERE a.grupo_id = ${grupoId} AND lower(a.email) = ${e})
       OR EXISTS (SELECT 1 FROM participantes p WHERE p.grupo_id = ${grupoId} AND lower(p.user_email) = ${e})
    LIMIT 1
  `
  return member.length ? 'read' : 'none'
}

export async function grupoIdDeParticipante(id: number): Promise<number | null> {
  await ensureSchema()
  const rows = await getSql()`SELECT grupo_id FROM participantes WHERE id = ${id}`
  return rows.length ? Number(rows[0].grupo_id) : null
}

export async function grupoIdDeDeseo(id: number): Promise<number | null> {
  await ensureSchema()
  const rows = await getSql()`
    SELECT p.grupo_id
    FROM deseos d JOIN participantes p ON p.id = d.participante_id
    WHERE d.id = ${id}
  `
  return rows.length ? Number(rows[0].grupo_id) : null
}

export async function grupoIdDeOpcion(id: number): Promise<number | null> {
  await ensureSchema()
  const rows = await getSql()`
    SELECT p.grupo_id
    FROM opciones o
    JOIN deseos d ON d.id = o.deseo_id
    JOIN participantes p ON p.id = d.participante_id
    WHERE o.id = ${id}
  `
  return rows.length ? Number(rows[0].grupo_id) : null
}

export interface AccesoRow { email: string; name: string; origen: string }

export async function listAcceso(grupoId: number): Promise<AccesoRow[]> {
  await ensureSchema()
  const rows = await getSql()`
    SELECT email, name, origen FROM grupo_acceso WHERE grupo_id = ${grupoId} ORDER BY name ASC
  `
  return rows.map((r) => ({
    email: r.email as string,
    name: r.name as string,
    origen: (r.origen as string) ?? 'miembro',
  }))
}

export async function grantGrupoAccess(grupoId: number, email: string, name: string, origen: string): Promise<void> {
  await ensureSchema()
  const e = email.toLowerCase()
  const nombre = name.trim() || e
  await getSql()`
    INSERT INTO grupo_acceso (grupo_id, email, name, origen)
    VALUES (${grupoId}, ${e}, ${nombre}, ${origen})
    ON CONFLICT (grupo_id, email) DO NOTHING
  `
}

export async function revokeGrupoAccess(grupoId: number, email: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  const e = email.toLowerCase()
  await sql`DELETE FROM grupo_acceso WHERE grupo_id = ${grupoId} AND lower(email) = ${e}`
  await sql`UPDATE participantes SET user_email = NULL WHERE grupo_id = ${grupoId} AND lower(user_email) = ${e}`
  await sql`UPDATE grupos SET owner_email = NULL, owner_name = NULL WHERE id = ${grupoId} AND lower(owner_email) = ${e}`
}

export async function setParticipanteUser(id: number, email: string | null): Promise<void> {
  await ensureSchema()
  await getSql()`UPDATE participantes SET user_email = ${email} WHERE id = ${id}`
}

export async function findGrupoIdByToken(token: string): Promise<{ id: number; nombre: string } | null> {
  if (!token) return null
  await ensureSchema()
  const rows = await getSql()`SELECT id, nombre FROM grupos WHERE token = ${token}`
  return rows.length ? { id: Number(rows[0].id), nombre: rows[0].nombre as string } : null
}
