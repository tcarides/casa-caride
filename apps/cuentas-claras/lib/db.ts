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
  createdAt: string
  closedAt: string | null
}
export interface Participante {
  id: number
  cuentaId: number
  name: string
  alias: string | null
  userEmail: string | null
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
  await sql`
    CREATE TABLE IF NOT EXISTS participantes (
      id BIGSERIAL PRIMARY KEY,
      cuenta_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      alias TEXT,
      user_email TEXT
    )
  `
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
  schemaReady = true
}

// ── Cuentas ──
export async function listCuentas(): Promise<Cuenta[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT id, name, status, owner_email, created_at, closed_at FROM cuentas ORDER BY created_at DESC`
  return rows.map((r) => ({
    id: Number(r.id), name: r.name as string, status: r.status as Cuenta['status'],
    ownerEmail: (r.owner_email as string | null) ?? null,
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
  const rows = await sql`SELECT id, name, status, owner_email, created_at, closed_at FROM cuentas WHERE id = ${id}`
  if (!rows.length) return null
  const r = rows[0]
  return {
    id: Number(r.id), name: r.name as string, status: r.status as Cuenta['status'],
    ownerEmail: (r.owner_email as string | null) ?? null,
    createdAt: r.created_at as string, closedAt: (r.closed_at as string | null) ?? null,
  }
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
  const rows = await sql`SELECT id, cuenta_id, name, alias, user_email FROM participantes WHERE cuenta_id = ${cuentaId} ORDER BY id ASC`
  return rows.map((r) => ({
    id: Number(r.id), cuentaId: Number(r.cuenta_id), name: r.name as string,
    alias: (r.alias as string | null) ?? null, userEmail: (r.user_email as string | null) ?? null,
  }))
}

export async function addParticipante(cuentaId: number, name: string, alias: string | null, userEmail: string | null = null): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`INSERT INTO participantes (cuenta_id, name, alias, user_email) VALUES (${cuentaId}, ${name}, ${alias}, ${userEmail})`
  if (alias) await sql`INSERT INTO contactos (name, alias) VALUES (${name}, ${alias}) ON CONFLICT (name) DO UPDATE SET alias = ${alias}`
}

export async function updateParticipante(id: number, name: string, alias: string | null): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`UPDATE participantes SET name = ${name}, alias = ${alias} WHERE id = ${id}`
  if (alias) await sql`INSERT INTO contactos (name, alias) VALUES (${name}, ${alias}) ON CONFLICT (name) DO UPDATE SET alias = ${alias}`
}

export async function deleteParticipante(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM participantes WHERE id = ${id}`
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
