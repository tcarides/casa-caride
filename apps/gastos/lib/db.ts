import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

// Gastos de Casa: gastos fijos (plantillas recurrentes) + movimientos (lo que
// realmente pasa cada mes). Montos en centavos (enteros). Moneda: ARS.
// Fechas de vencimiento/pago como TEXT 'YYYY-MM-DD' (sin tz), como en cuentas.

type Sql = NeonQueryFunction<false, false>
let _sql: Sql | undefined

export function getSql(): Sql {
  if (_sql) return _sql
  const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL
  if (!conn) throw new Error('Falta DATABASE_URL (Neon de Gastos de Casa).')
  _sql = neon(conn)
  return _sql
}

export type Frecuencia = 'mensual' | 'bimestral' | 'anual'
export type Pagador = string // nombre de persona o 'Compartido'
export type TipoMov = 'fijo' | 'variable'

export interface Persona {
  id: number
  nombre: string
  orden: number
}

export interface GastoFijo {
  id: number
  nombre: string
  categoria: string
  pagador: Pagador
  montoEstimado: number // centavos
  diaVencimiento: number | null // 1..31
  frecuencia: Frecuencia
  mesAncla: number | null // 1..12 · para bimestral (paridad) y anual (mes)
  activo: boolean
}

export interface Movimiento {
  id: number
  periodo: string // 'YYYY-MM'
  fijoId: number | null // null = variable
  nombre: string
  categoria: string
  pagador: Pagador
  monto: number // centavos
  vencimiento: string | null // 'YYYY-MM-DD'
  pagado: boolean
  fechaPago: string | null // 'YYYY-MM-DD'
  tipo: TipoMov
  omitido: boolean // fijo salteado este mes (no se regenera)
  createdAt: string
}

// ── Schema ──
let schemaReady = false
export async function ensureSchema(): Promise<void> {
  if (schemaReady) return
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS personas (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      orden INT NOT NULL DEFAULT 0
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS gastos_fijos (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'Otros',
      pagador TEXT NOT NULL DEFAULT 'Compartido',
      monto_estimado_centavos BIGINT NOT NULL DEFAULT 0,
      dia_vencimiento INT,
      frecuencia TEXT NOT NULL DEFAULT 'mensual',
      mes_ancla INT,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS movimientos (
      id BIGSERIAL PRIMARY KEY,
      periodo TEXT NOT NULL,
      fijo_id BIGINT,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'Otros',
      pagador TEXT NOT NULL DEFAULT 'Compartido',
      monto_centavos BIGINT NOT NULL DEFAULT 0,
      vencimiento TEXT,
      pagado BOOLEAN NOT NULL DEFAULT FALSE,
      fecha_pago TEXT,
      tipo TEXT NOT NULL DEFAULT 'variable',
      omitido BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  // Un solo movimiento por (periodo, fijo) → la generación mensual es idempotente.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mov_periodo_fijo ON movimientos (periodo, fijo_id) WHERE fijo_id IS NOT NULL`

  // Semilla de personas de la casa (solo la primera vez).
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM personas` as { n: number }[]
  if (n === 0) {
    await sql`INSERT INTO personas (nombre, orden) VALUES ('Tomás', 1), ('Flor', 2)`
  }
  schemaReady = true
}

// ── Personas ──
export async function listPersonas(): Promise<Persona[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT id, nombre, orden FROM personas ORDER BY orden ASC, id ASC`
  return rows.map((r) => ({ id: Number(r.id), nombre: r.nombre as string, orden: Number(r.orden) }))
}

// ── Gastos fijos (plantillas) ──
function mapFijo(r: Record<string, unknown>): GastoFijo {
  return {
    id: Number(r.id),
    nombre: r.nombre as string,
    categoria: r.categoria as string,
    pagador: r.pagador as string,
    montoEstimado: Number(r.monto_estimado_centavos),
    diaVencimiento: r.dia_vencimiento == null ? null : Number(r.dia_vencimiento),
    frecuencia: r.frecuencia as Frecuencia,
    mesAncla: r.mes_ancla == null ? null : Number(r.mes_ancla),
    activo: r.activo === true,
  }
}

export async function listFijos(): Promise<GastoFijo[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT id, nombre, categoria, pagador, monto_estimado_centavos, dia_vencimiento,
           frecuencia, mes_ancla, activo
    FROM gastos_fijos ORDER BY activo DESC, nombre ASC`
  return rows.map(mapFijo)
}

export interface FijoInput {
  nombre: string
  categoria: string
  pagador: string
  montoEstimado: number
  diaVencimiento: number | null
  frecuencia: Frecuencia
  mesAncla: number | null
}

export async function createFijo(f: FijoInput): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO gastos_fijos (nombre, categoria, pagador, monto_estimado_centavos, dia_vencimiento, frecuencia, mes_ancla)
    VALUES (${f.nombre}, ${f.categoria}, ${f.pagador}, ${f.montoEstimado}, ${f.diaVencimiento}, ${f.frecuencia}, ${f.mesAncla})
    RETURNING id`
  return Number(row.id)
}

export async function updateFijo(id: number, f: FijoInput): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    UPDATE gastos_fijos SET
      nombre = ${f.nombre}, categoria = ${f.categoria}, pagador = ${f.pagador},
      monto_estimado_centavos = ${f.montoEstimado}, dia_vencimiento = ${f.diaVencimiento},
      frecuencia = ${f.frecuencia}, mes_ancla = ${f.mesAncla}
    WHERE id = ${id}`
}

/** Baja/alta lógica: no borra instancias ya generadas. */
export async function setFijoActivo(id: number, activo: boolean): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`UPDATE gastos_fijos SET activo = ${activo} WHERE id = ${id}`
}

/** Borra la plantilla y sus movimientos aún no pagados (conserva historial pagado). */
export async function deleteFijo(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM movimientos WHERE fijo_id = ${id} AND pagado = FALSE`
  await sql`UPDATE movimientos SET fijo_id = NULL WHERE fijo_id = ${id}`
  await sql`DELETE FROM gastos_fijos WHERE id = ${id}`
}

// ── Generación mensual + movimientos ──

/** Último día del mes de un periodo 'YYYY-MM'. */
function lastDayOfMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate() // month1 es 1..12 → día 0 del siguiente
}

/** Fecha de vencimiento 'YYYY-MM-DD' a partir de un periodo y día (clamp a fin de mes). */
function vencimientoDe(periodo: string, dia: number | null): string | null {
  if (!dia) return null
  const [y, m] = periodo.split('-').map(Number)
  const d = Math.min(dia, lastDayOfMonth(y, m))
  return `${periodo}-${String(d).padStart(2, '0')}`
}

/** ¿La plantilla aplica a este mes según su frecuencia? */
function aplicaEnMes(f: GastoFijo, month1: number): boolean {
  if (f.frecuencia === 'mensual') return true
  const ancla = f.mesAncla ?? 1
  if (f.frecuencia === 'anual') return month1 === ancla
  // bimestral: mismo "paso" de 2 meses que el ancla (misma paridad)
  return (month1 - ancla) % 2 === 0
}

/** Crea (idempotente) los movimientos de los gastos fijos activos que aplican
 *  a este periodo, y devuelve todos los movimientos del mes. */
export async function ensureMonth(periodo: string): Promise<Movimiento[]> {
  await ensureSchema()
  const sql = getSql()
  const [, mStr] = periodo.split('-')
  const month1 = Number(mStr)

  const fijos = (await listFijos()).filter((f) => f.activo && aplicaEnMes(f, month1))
  for (const f of fijos) {
    // ON CONFLICT (índice único periodo+fijo) → no duplica ni pisa lo cargado.
    await sql`
      INSERT INTO movimientos (periodo, fijo_id, nombre, categoria, pagador, monto_centavos, vencimiento, tipo)
      VALUES (${periodo}, ${f.id}, ${f.nombre}, ${f.categoria}, ${f.pagador}, ${f.montoEstimado}, ${vencimientoDe(periodo, f.diaVencimiento)}, 'fijo')
      ON CONFLICT (periodo, fijo_id) WHERE fijo_id IS NOT NULL DO NOTHING`
  }
  return listMovimientos(periodo)
}

function mapMov(r: Record<string, unknown>): Movimiento {
  return {
    id: Number(r.id),
    periodo: r.periodo as string,
    fijoId: r.fijo_id == null ? null : Number(r.fijo_id),
    nombre: r.nombre as string,
    categoria: r.categoria as string,
    pagador: r.pagador as string,
    monto: Number(r.monto_centavos),
    vencimiento: (r.vencimiento as string | null) ?? null,
    pagado: r.pagado === true,
    fechaPago: (r.fecha_pago as string | null) ?? null,
    tipo: r.tipo as TipoMov,
    omitido: r.omitido === true,
    createdAt: r.created_at as string,
  }
}

export async function listMovimientos(periodo: string): Promise<Movimiento[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT id, periodo, fijo_id, nombre, categoria, pagador, monto_centavos,
           vencimiento, pagado, fecha_pago, tipo, omitido, created_at
    FROM movimientos WHERE periodo = ${periodo}
    ORDER BY pagado ASC, vencimiento ASC NULLS LAST, created_at ASC`
  return rows.map(mapMov)
}

export interface MovimientoInput {
  nombre: string
  categoria: string
  pagador: string
  monto: number
  vencimiento: string | null
  pagado: boolean
  fechaPago: string | null
}

/** Alta de un movimiento suelto (gasto variable del mes). */
export async function addMovimiento(periodo: string, m: MovimientoInput): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO movimientos (periodo, fijo_id, nombre, categoria, pagador, monto_centavos, vencimiento, pagado, fecha_pago, tipo)
    VALUES (${periodo}, NULL, ${m.nombre}, ${m.categoria}, ${m.pagador}, ${m.monto}, ${m.vencimiento}, ${m.pagado}, ${m.fechaPago}, 'variable')
    RETURNING id`
  return Number(row.id)
}

export interface MovimientoPatch {
  nombre?: string
  categoria?: string
  pagador?: string
  monto?: number
  vencimiento?: string | null
  pagado?: boolean
  fechaPago?: string | null
}

export async function updateMovimiento(id: number, p: MovimientoPatch): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  // Actualización parcial: solo pisa los campos presentes (COALESCE por campo).
  await sql`
    UPDATE movimientos SET
      nombre = COALESCE(${p.nombre ?? null}, nombre),
      categoria = COALESCE(${p.categoria ?? null}, categoria),
      pagador = COALESCE(${p.pagador ?? null}, pagador),
      monto_centavos = COALESCE(${p.monto ?? null}, monto_centavos),
      vencimiento = CASE WHEN ${p.vencimiento !== undefined} THEN ${p.vencimiento ?? null} ELSE vencimiento END,
      pagado = COALESCE(${p.pagado ?? null}, pagado),
      fecha_pago = CASE WHEN ${p.fechaPago !== undefined} THEN ${p.fechaPago ?? null} ELSE fecha_pago END
    WHERE id = ${id}`
}

/** Borra un movimiento. Un fijo generado se marca 'omitido' (no se regenera);
 *  un variable se elimina de verdad. */
export async function deleteMovimiento(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT tipo FROM movimientos WHERE id = ${id}`
  const tipo = rows.length ? (rows[0].tipo as string) : null
  if (tipo === 'fijo') {
    await sql`UPDATE movimientos SET omitido = TRUE, pagado = FALSE, fecha_pago = NULL WHERE id = ${id}`
  } else {
    await sql`DELETE FROM movimientos WHERE id = ${id}`
  }
}

/** Restaura un fijo omitido este mes. */
export async function restoreMovimiento(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`UPDATE movimientos SET omitido = FALSE WHERE id = ${id}`
}
