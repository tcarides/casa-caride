import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { computeBalances, simplifyDebts } from './calc'

// Cuentas Claras: cuentas (eventos), participantes, gastos y liquidaciones.
// Montos en centavos (enteros). Moneda: ARS.

type Sql = NeonQueryFunction<false, false>
let _sql: Sql | undefined

export function getSql(): Sql {
  if (_sql) return _sql
  const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL
  if (!conn) throw new Error('Falta DATABASE_URL (Neon de Cuentas Claras).')
  _sql = neon(conn)
  return _sql
}

export interface Cuenta {
  id: number
  name: string
  status: 'abierta' | 'cerrada'
  ownerEmail: string | null
  fecha: string | null // 'YYYY-MM-DD' del evento (opcional)
  createdAt: string
  closedAt: string | null
}
export type EstadoCarga = 'pendiente' | 'listo' | 'sin_gastos'
export interface Participante {
  id: number
  cuentaId: number
  name: string
  alias: string | null
  userEmail: string | null
  estado: EstadoCarga
}
export interface Gasto {
  id: number
  cuentaId: number
  descripcion: string
  monto: number // centavos
  pagadorId: number
  comprobanteUrl: string | null
  createdAt: string
}
export interface Liquidacion {
  id: number
  cuentaId: number
  fromId: number
  toId: number
  monto: number // centavos
  pagado: boolean
}

let schemaReady = false
export async function ensureSchema(): Promise<void> {
  if (schemaReady) return
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS cuentas (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'abierta',
      owner_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    )
  `
  // Fecha del evento (texto 'YYYY-MM-DD', sin tz): se muestra "viernes 27 de junio".
  await sql`ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS fecha TEXT`
  await sql`
    CREATE TABLE IF NOT EXISTS participantes (
      id BIGSERIAL PRIMARY KEY,
      cuenta_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      alias TEXT,
      user_email TEXT
    )
  `
  // Estado de carga: pendiente (default) | listo (ya cargó) | sin_gastos (no gastó).
  await sql`ALTER TABLE participantes ADD COLUMN IF NOT EXISTS estado_carga TEXT NOT NULL DEFAULT 'pendiente'`
  await sql`
    CREATE TABLE IF NOT EXISTS gastos (
      id BIGSERIAL PRIMARY KEY,
      cuenta_id BIGINT NOT NULL,
      descripcion TEXT NOT NULL,
      monto_centavos BIGINT NOT NULL,
      pagador_id BIGINT NOT NULL,
      comprobante_url TEXT,
      comprobante_path TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS liquidaciones (
      id BIGSERIAL PRIMARY KEY,
      cuenta_id BIGINT NOT NULL,
      from_id BIGINT NOT NULL,
      to_id BIGINT NOT NULL,
      monto_centavos BIGINT NOT NULL,
      pagado BOOLEAN NOT NULL DEFAULT FALSE
    )
  `
  // Libreta de alias reutilizables.
  await sql`
    CREATE TABLE IF NOT EXISTS contactos (
      name  TEXT PRIMARY KEY,
      alias TEXT
    )
  `
  // Grupos de contactos, privados por usuario (owner_email).
  await sql`
    CREATE TABLE IF NOT EXISTS grupos (
      id BIGSERIAL PRIMARY KEY,
      owner_email TEXT,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS grupo_miembros (
      id BIGSERIAL PRIMARY KEY,
      grupo_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      alias TEXT
    )
  `
  // Vínculo opcional a un usuario registrado de Casa Caride: al importar el
  // grupo, el participante queda asociado a su email (ve la cuenta sin "soy yo").
  await sql`ALTER TABLE grupo_miembros ADD COLUMN IF NOT EXISTS user_email TEXT`
  // Alias / CBU guardado por usuario (email): se reutiliza en toda cuenta o grupo.
  await sql`
    CREATE TABLE IF NOT EXISTS usuario_alias (
      email TEXT PRIMARY KEY,
      alias TEXT
    )
  `
  schemaReady = true
}

// ── Cuentas ──
// Cada uno ve lo suyo: las cuentas que creó (owner_email) o donde figura como
// participante vinculado a su email. Las legacy sin dueño (owner_email NULL)
// quedan visibles para todos para no perder datos viejos.
export async function listCuentas(email: string | null): Promise<Cuenta[]> {
  await ensureSchema()
  const sql = getSql()
  const e = email?.toLowerCase() ?? null
  const rows = await sql`
    SELECT id, name, status, owner_email, fecha, created_at, closed_at
    FROM cuentas c
    WHERE c.owner_email IS NULL
       OR lower(c.owner_email) = ${e}
       OR EXISTS (
            SELECT 1 FROM participantes p
            WHERE p.cuenta_id = c.id AND lower(p.user_email) = ${e}
          )
    ORDER BY created_at DESC
  `
  return rows.map((r) => ({
    id: Number(r.id), name: r.name as string, status: r.status as Cuenta['status'],
    ownerEmail: (r.owner_email as string | null) ?? null, fecha: (r.fecha as string | null) ?? null,
    createdAt: r.created_at as string, closedAt: (r.closed_at as string | null) ?? null,
  }))
}

export async function createCuenta(name: string, ownerEmail: string | null): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [row] = await sql`INSERT INTO cuentas (name, owner_email) VALUES (${name}, ${ownerEmail}) RETURNING id`
  return Number(row.id)
}

export async function getCuenta(id: number): Promise<Cuenta | null> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT id, name, status, owner_email, fecha, created_at, closed_at FROM cuentas WHERE id = ${id}`
  if (!rows.length) return null
  const r = rows[0]
  return {
    id: Number(r.id), name: r.name as string, status: r.status as Cuenta['status'],
    ownerEmail: (r.owner_email as string | null) ?? null, fecha: (r.fecha as string | null) ?? null,
    createdAt: r.created_at as string, closedAt: (r.closed_at as string | null) ?? null,
  }
}

/** Fija (o limpia) la fecha del evento. Espera 'YYYY-MM-DD' o null. */
export async function setFecha(id: number, fecha: string | null): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`UPDATE cuentas SET fecha = ${fecha} WHERE id = ${id}`
}

export async function deleteCuenta(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM gastos WHERE cuenta_id = ${id}`
  await sql`DELETE FROM participantes WHERE cuenta_id = ${id}`
  await sql`DELETE FROM liquidaciones WHERE cuenta_id = ${id}`
  await sql`DELETE FROM cuentas WHERE id = ${id}`
}

// ── Participantes ──
export async function getParticipantes(cuentaId: number): Promise<Participante[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT id, cuenta_id, name, alias, user_email, estado_carga FROM participantes WHERE cuenta_id = ${cuentaId} ORDER BY id ASC`
  return rows.map((r) => ({
    id: Number(r.id), cuentaId: Number(r.cuenta_id), name: r.name as string,
    alias: (r.alias as string | null) ?? null, userEmail: (r.user_email as string | null) ?? null,
    estado: ((r.estado_carga as EstadoCarga) ?? 'pendiente'),
  }))
}

export async function addParticipante(cuentaId: number, name: string, alias: string | null, userEmail: string | null = null): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  // Si está vinculado a un usuario y no vino alias, reusamos el guardado del usuario.
  let effAlias = alias
  if (userEmail && !effAlias) effAlias = await getUserAlias(userEmail)
  await sql`INSERT INTO participantes (cuenta_id, name, alias, user_email) VALUES (${cuentaId}, ${name}, ${effAlias}, ${userEmail})`
  if (effAlias) await sql`INSERT INTO contactos (name, alias) VALUES (${name}, ${effAlias}) ON CONFLICT (name) DO UPDATE SET alias = ${effAlias}`
  if (userEmail && effAlias) await setUserAlias(userEmail, effAlias)
}

export async function updateParticipante(id: number, name: string, alias: string | null): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`UPDATE participantes SET name = ${name}, alias = ${alias} WHERE id = ${id}`
  if (alias) await sql`INSERT INTO contactos (name, alias) VALUES (${name}, ${alias}) ON CONFLICT (name) DO UPDATE SET alias = ${alias}`
  // Si el participante está vinculado a un usuario, guardamos su alias para reusarlo.
  const rows = await sql`SELECT user_email FROM participantes WHERE id = ${id}`
  const email = (rows[0]?.user_email as string | null) ?? null
  if (email && alias) await setUserAlias(email, alias)
}

// ── Alias por usuario registrado (se reutiliza en cuentas y grupos) ──
export async function getUserAlias(email: string): Promise<string | null> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT alias FROM usuario_alias WHERE email = ${email.toLowerCase()}`
  return rows.length ? ((rows[0].alias as string | null) ?? null) : null
}

export async function getUserAliases(): Promise<Record<string, string>> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT email, alias FROM usuario_alias WHERE alias IS NOT NULL`
  const map: Record<string, string> = {}
  for (const r of rows) map[(r.email as string).toLowerCase()] = r.alias as string
  return map
}

export async function setUserAlias(email: string, alias: string | null): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    INSERT INTO usuario_alias (email, alias) VALUES (${email.toLowerCase()}, ${alias})
    ON CONFLICT (email) DO UPDATE SET alias = ${alias}
  `
}

export async function deleteParticipante(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM participantes WHERE id = ${id}`
}

export async function setEstadoCarga(id: number, estado: EstadoCarga): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`UPDATE participantes SET estado_carga = ${estado} WHERE id = ${id}`
}

/** "Este soy yo": vincula un participante a mi email para que la cuenta me
 *  aparezca. Un solo participante por usuario en cada cuenta (libera otros). */
export async function claimParticipante(id: number, email: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  const e = email.toLowerCase()
  await sql`
    UPDATE participantes SET user_email = NULL
    WHERE lower(user_email) = ${e}
      AND cuenta_id = (SELECT cuenta_id FROM participantes WHERE id = ${id})
  `
  await sql`UPDATE participantes SET user_email = ${e} WHERE id = ${id}`
}

/** "No soy yo": suelta el vínculo (solo el dueño del vínculo puede soltarlo). */
export async function unclaimParticipante(id: number, email: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`UPDATE participantes SET user_email = NULL WHERE id = ${id} AND lower(user_email) = ${email.toLowerCase()}`
}

/** Cuántos participantes siguen en "pendiente" (no se puede cerrar si > 0). */
export async function getPendientes(cuentaId: number): Promise<Participante[]> {
  const parts = await getParticipantes(cuentaId)
  return parts.filter((p) => p.estado === 'pendiente')
}

// ── Gastos ──
export async function getGastos(cuentaId: number): Promise<Gasto[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT id, cuenta_id, descripcion, monto_centavos, pagador_id, comprobante_url, created_at FROM gastos WHERE cuenta_id = ${cuentaId} ORDER BY created_at ASC`
  return rows.map((r) => ({
    id: Number(r.id), cuentaId: Number(r.cuenta_id), descripcion: r.descripcion as string,
    monto: Number(r.monto_centavos), pagadorId: Number(r.pagador_id),
    comprobanteUrl: (r.comprobante_url as string | null) ?? null, createdAt: r.created_at as string,
  }))
}

export async function addGasto(
  cuentaId: number, descripcion: string, monto: number, pagadorId: number,
  comprobanteUrl: string | null = null, comprobantePath: string | null = null,
): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    INSERT INTO gastos (cuenta_id, descripcion, monto_centavos, pagador_id, comprobante_url, comprobante_path)
    VALUES (${cuentaId}, ${descripcion}, ${monto}, ${pagadorId}, ${comprobanteUrl}, ${comprobantePath})
  `
  // Quien tiene un gasto cargado ya no está "pendiente" (lo cargó él o un 3ro por él).
  await sql`UPDATE participantes SET estado_carga = 'listo' WHERE id = ${pagadorId} AND estado_carga = 'pendiente'`
}

export async function updateGasto(
  id: number, descripcion: string, monto: number, pagadorId: number,
): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    UPDATE gastos SET descripcion = ${descripcion}, monto_centavos = ${monto}, pagador_id = ${pagadorId}
    WHERE id = ${id}
  `
}

export async function deleteGasto(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM gastos WHERE id = ${id}`
}

/** pathname del comprobante (para servirlo privado por id de gasto). */
export async function getGastoComprobante(id: number): Promise<string | null> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT comprobante_path FROM gastos WHERE id = ${id}`
  return rows.length ? ((rows[0].comprobante_path as string | null) ?? null) : null
}

// ── Cierre / liquidaciones ──
export async function getLiquidaciones(cuentaId: number): Promise<Liquidacion[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT id, cuenta_id, from_id, to_id, monto_centavos, pagado FROM liquidaciones WHERE cuenta_id = ${cuentaId} ORDER BY id ASC`
  return rows.map((r) => ({
    id: Number(r.id), cuentaId: Number(r.cuenta_id), fromId: Number(r.from_id),
    toId: Number(r.to_id), monto: Number(r.monto_centavos), pagado: r.pagado === true,
  }))
}

export async function closeCuenta(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  const [parts, gastos] = await Promise.all([getParticipantes(id), getGastos(id)])
  const balances = computeBalances(parts.map((p) => p.id), gastos.map((g) => ({ payerId: g.pagadorId, amount: g.monto })))
  const transfers = simplifyDebts(balances)
  await sql`DELETE FROM liquidaciones WHERE cuenta_id = ${id}`
  for (const t of transfers) {
    await sql`INSERT INTO liquidaciones (cuenta_id, from_id, to_id, monto_centavos) VALUES (${id}, ${t.from}, ${t.to}, ${t.amount})`
  }
  await sql`UPDATE cuentas SET status = 'cerrada', closed_at = NOW() WHERE id = ${id}`
}

export async function reopenCuenta(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM liquidaciones WHERE cuenta_id = ${id}`
  await sql`UPDATE cuentas SET status = 'abierta', closed_at = NULL WHERE id = ${id}`
}

export async function setLiquidacionPagado(id: number, pagado: boolean): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`UPDATE liquidaciones SET pagado = ${pagado} WHERE id = ${id}`
}

// ── Contactos (libreta de alias) ──
export async function listContactos(): Promise<{ name: string; alias: string }[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT name, alias FROM contactos WHERE alias IS NOT NULL ORDER BY name ASC`
  return rows.map((r) => ({ name: r.name as string, alias: r.alias as string }))
}

// ── Grupos de contactos (privados por usuario) ──
export interface Grupo { id: number; name: string; miembros: number }
export interface Miembro { id: number; name: string; alias: string | null; userEmail: string | null }

export async function listGrupos(ownerEmail: string | null): Promise<Grupo[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT g.id, g.name, COUNT(m.id) AS miembros
    FROM grupos g LEFT JOIN grupo_miembros m ON m.grupo_id = g.id
    WHERE g.owner_email IS NOT DISTINCT FROM ${ownerEmail}
    GROUP BY g.id, g.name
    ORDER BY g.name ASC
  `
  return rows.map((r) => ({ id: Number(r.id), name: r.name as string, miembros: Number(r.miembros) }))
}

export async function createGrupo(ownerEmail: string | null, name: string): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [row] = await sql`INSERT INTO grupos (owner_email, name) VALUES (${ownerEmail}, ${name}) RETURNING id`
  return Number(row.id)
}

/** Dueño de un grupo (para chequear permisos). */
export async function grupoOwner(grupoId: number): Promise<string | null | undefined> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT owner_email FROM grupos WHERE id = ${grupoId}`
  return rows.length ? ((rows[0].owner_email as string | null) ?? null) : undefined
}

export async function getGrupo(grupoId: number): Promise<{ id: number; name: string } | null> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT id, name FROM grupos WHERE id = ${grupoId}`
  return rows.length ? { id: Number(rows[0].id), name: rows[0].name as string } : null
}

export async function deleteGrupo(grupoId: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM grupo_miembros WHERE grupo_id = ${grupoId}`
  await sql`DELETE FROM grupos WHERE id = ${grupoId}`
}

export async function getMiembros(grupoId: number): Promise<Miembro[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT id, name, alias, user_email FROM grupo_miembros WHERE grupo_id = ${grupoId} ORDER BY name ASC`
  return rows.map((r) => ({
    id: Number(r.id), name: r.name as string, alias: (r.alias as string | null) ?? null,
    userEmail: (r.user_email as string | null) ?? null,
  }))
}

export async function addMiembro(grupoId: number, name: string, alias: string | null, userEmail: string | null = null): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  let effAlias = alias
  if (userEmail && !effAlias) effAlias = await getUserAlias(userEmail)
  await sql`INSERT INTO grupo_miembros (grupo_id, name, alias, user_email) VALUES (${grupoId}, ${name}, ${effAlias}, ${userEmail})`
  if (effAlias) await sql`INSERT INTO contactos (name, alias) VALUES (${name}, ${effAlias}) ON CONFLICT (name) DO UPDATE SET alias = ${effAlias}`
  if (userEmail && effAlias) await setUserAlias(userEmail, effAlias)
}

/** Mis contactos para sumar a una cuenta: miembros (distintos por nombre) de
 *  los grupos donde soy dueño o miembro vinculado. Incluye registrados y de
 *  texto libre; los registrados traen su email (para vincularse al importar). */
export async function getMisContactos(email: string): Promise<{ name: string; alias: string | null; email: string | null }[]> {
  await ensureSchema()
  const sql = getSql()
  const e = email.toLowerCase()
  const rows = await sql`
    WITH mis_grupos AS (
      SELECT id FROM grupos WHERE lower(owner_email) = ${e}
      UNION
      SELECT grupo_id AS id FROM grupo_miembros WHERE lower(user_email) = ${e}
    )
    SELECT DISTINCT ON (lower(m.name)) m.name, m.alias, m.user_email AS email
    FROM grupo_miembros m
    WHERE m.grupo_id IN (SELECT id FROM mis_grupos)
    ORDER BY lower(m.name), m.id ASC
  `
  return rows.map((r) => ({
    name: r.name as string, alias: (r.alias as string | null) ?? null,
    email: (r.email as string | null) ?? null,
  }))
}

/** Usuarios registrados con los que el solicitante comparte algún grupo
 *  (mismo grupo: como dueño o como miembro vinculado). Para no-admins, que no
 *  ven el directorio completo. Devuelve nombre + email. */
export async function getCoGroupUsers(email: string): Promise<{ name: string; email: string }[]> {
  await ensureSchema()
  const sql = getSql()
  const e = email.toLowerCase()
  const rows = await sql`
    WITH mis_grupos AS (
      SELECT id FROM grupos WHERE lower(owner_email) = ${e}
      UNION
      SELECT grupo_id AS id FROM grupo_miembros WHERE lower(user_email) = ${e}
    )
    SELECT DISTINCT ON (lower(m.user_email)) m.name, m.user_email AS email
    FROM grupo_miembros m
    WHERE m.grupo_id IN (SELECT id FROM mis_grupos)
      AND m.user_email IS NOT NULL
      AND lower(m.user_email) <> ${e}
    ORDER BY lower(m.user_email), m.name ASC
  `
  return rows.map((r) => ({ name: r.name as string, email: r.email as string }))
}

export async function deleteMiembro(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM grupo_miembros WHERE id = ${id}`
}

export async function miembroGrupo(id: number): Promise<number | undefined> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT grupo_id FROM grupo_miembros WHERE id = ${id}`
  return rows.length ? Number(rows[0].grupo_id) : undefined
}

/** Agrega los miembros de un grupo como participantes de la cuenta (sin duplicar por nombre). */
export async function importarGrupo(cuentaId: number, grupoId: number): Promise<number> {
  const miembros = await getMiembros(grupoId)
  const existentes = (await getParticipantes(cuentaId)).map((p) => p.name.toLowerCase())
  let added = 0
  for (const m of miembros) {
    if (!existentes.includes(m.name.toLowerCase())) {
      await addParticipante(cuentaId, m.name, m.alias, m.userEmail)
      added++
    }
  }
  return added
}
