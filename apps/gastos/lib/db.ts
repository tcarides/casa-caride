import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

// Gastos de Casa: gastos fijos (plantillas recurrentes) + movimientos (lo que
// realmente pasa cada mes). Montos en centavos (enteros). Moneda ARS o USD
// (el alquiler es en dólares). Fechas de vencimiento/pago como TEXT 'YYYY-MM-DD'.

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
export type Moneda = 'ARS' | 'USD'
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
  moneda: Moneda
  montoEstimado: number // centavos (de la moneda)
  diaVencimiento: number | null // 1..31
  frecuencia: Frecuencia
  mesAncla: number | null // 1..12 · para bimestral (paridad) y anual (mes)
  medioPago: string | null
  notas: string | null
  automatico: boolean // se cobra solo (tarjeta/débito) → no requiere acción
  activo: boolean
}

export interface Movimiento {
  id: number
  periodo: string // 'YYYY-MM'
  fijoId: number | null // null = variable
  nombre: string
  categoria: string
  pagador: Pagador
  moneda: Moneda
  monto: number // centavos
  vencimiento: string | null // 'YYYY-MM-DD'
  pagado: boolean
  fechaPago: string | null // 'YYYY-MM-DD'
  medioPago: string | null
  notas: string | null
  automatico: boolean
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
  // Migraciones idempotentes: campos sumados después (moneda, medio de pago,
  // notas, automático). ADD COLUMN IF NOT EXISTS no pisa datos existentes.
  await sql`ALTER TABLE gastos_fijos ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS'`
  await sql`ALTER TABLE gastos_fijos ADD COLUMN IF NOT EXISTS medio_pago TEXT`
  await sql`ALTER TABLE gastos_fijos ADD COLUMN IF NOT EXISTS notas TEXT`
  await sql`ALTER TABLE gastos_fijos ADD COLUMN IF NOT EXISTS automatico BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS'`
  await sql`ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS medio_pago TEXT`
  await sql`ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS notas TEXT`
  await sql`ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS automatico BOOLEAN NOT NULL DEFAULT FALSE`

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
    moneda: (r.moneda as Moneda) ?? 'ARS',
    montoEstimado: Number(r.monto_estimado_centavos),
    diaVencimiento: r.dia_vencimiento == null ? null : Number(r.dia_vencimiento),
    frecuencia: r.frecuencia as Frecuencia,
    mesAncla: r.mes_ancla == null ? null : Number(r.mes_ancla),
    medioPago: (r.medio_pago as string | null) ?? null,
    notas: (r.notas as string | null) ?? null,
    automatico: r.automatico === true,
    activo: r.activo === true,
  }
}

export async function listFijos(): Promise<GastoFijo[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT id, nombre, categoria, pagador, moneda, monto_estimado_centavos, dia_vencimiento,
           frecuencia, mes_ancla, medio_pago, notas, automatico, activo
    FROM gastos_fijos ORDER BY activo DESC, nombre ASC`
  return rows.map(mapFijo)
}

export interface FijoInput {
  nombre: string
  categoria: string
  pagador: string
  moneda: Moneda
  montoEstimado: number
  diaVencimiento: number | null
  frecuencia: Frecuencia
  mesAncla: number | null
  medioPago: string | null
  notas: string | null
  automatico: boolean
}

export async function createFijo(f: FijoInput): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO gastos_fijos
      (nombre, categoria, pagador, moneda, monto_estimado_centavos, dia_vencimiento, frecuencia, mes_ancla, medio_pago, notas, automatico)
    VALUES
      (${f.nombre}, ${f.categoria}, ${f.pagador}, ${f.moneda}, ${f.montoEstimado}, ${f.diaVencimiento}, ${f.frecuencia}, ${f.mesAncla}, ${f.medioPago}, ${f.notas}, ${f.automatico})
    RETURNING id`
  return Number(row.id)
}

export async function updateFijo(id: number, f: FijoInput): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    UPDATE gastos_fijos SET
      nombre = ${f.nombre}, categoria = ${f.categoria}, pagador = ${f.pagador}, moneda = ${f.moneda},
      monto_estimado_centavos = ${f.montoEstimado}, dia_vencimiento = ${f.diaVencimiento},
      frecuencia = ${f.frecuencia}, mes_ancla = ${f.mesAncla},
      medio_pago = ${f.medioPago}, notas = ${f.notas}, automatico = ${f.automatico}
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

/** Inserta una plantilla solo si no existe otra con el mismo nombre (para el seed). */
export async function createFijoIfMissing(f: FijoInput): Promise<boolean> {
  await ensureSchema()
  const sql = getSql()
  const existing = await sql`SELECT 1 FROM gastos_fijos WHERE lower(nombre) = ${f.nombre.toLowerCase()} LIMIT 1`
  if (existing.length) return false
  await createFijo(f)
  return true
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
      INSERT INTO movimientos
        (periodo, fijo_id, nombre, categoria, pagador, moneda, monto_centavos, vencimiento, medio_pago, notas, automatico, tipo)
      VALUES
        (${periodo}, ${f.id}, ${f.nombre}, ${f.categoria}, ${f.pagador}, ${f.moneda}, ${f.montoEstimado}, ${vencimientoDe(periodo, f.diaVencimiento)}, ${f.medioPago}, ${f.notas}, ${f.automatico}, 'fijo')
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
    moneda: (r.moneda as Moneda) ?? 'ARS',
    monto: Number(r.monto_centavos),
    vencimiento: (r.vencimiento as string | null) ?? null,
    pagado: r.pagado === true,
    fechaPago: (r.fecha_pago as string | null) ?? null,
    medioPago: (r.medio_pago as string | null) ?? null,
    notas: (r.notas as string | null) ?? null,
    automatico: r.automatico === true,
    tipo: r.tipo as TipoMov,
    omitido: r.omitido === true,
    createdAt: r.created_at as string,
  }
}

export async function listMovimientos(periodo: string): Promise<Movimiento[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT id, periodo, fijo_id, nombre, categoria, pagador, moneda, monto_centavos,
           vencimiento, pagado, fecha_pago, medio_pago, notas, automatico, tipo, omitido, created_at
    FROM movimientos WHERE periodo = ${periodo}
    ORDER BY pagado ASC, vencimiento ASC NULLS LAST, created_at ASC`
  return rows.map(mapMov)
}

export interface MovimientoInput {
  nombre: string
  categoria: string
  pagador: string
  moneda: Moneda
  monto: number
  vencimiento: string | null
  pagado: boolean
  fechaPago: string | null
  medioPago: string | null
  notas: string | null
}

/** Alta de un movimiento suelto (gasto variable del mes). */
export async function addMovimiento(periodo: string, m: MovimientoInput): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO movimientos
      (periodo, fijo_id, nombre, categoria, pagador, moneda, monto_centavos, vencimiento, pagado, fecha_pago, medio_pago, notas, tipo)
    VALUES
      (${periodo}, NULL, ${m.nombre}, ${m.categoria}, ${m.pagador}, ${m.moneda}, ${m.monto}, ${m.vencimiento}, ${m.pagado}, ${m.fechaPago}, ${m.medioPago}, ${m.notas}, 'variable')
    RETURNING id`
  return Number(row.id)
}

export interface MovimientoPatch {
  nombre?: string
  categoria?: string
  pagador?: string
  moneda?: Moneda
  monto?: number
  vencimiento?: string | null
  pagado?: boolean
  fechaPago?: string | null
  medioPago?: string | null
  notas?: string | null
}

export async function updateMovimiento(id: number, p: MovimientoPatch): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  // Actualización parcial: solo pisa los campos presentes.
  await sql`
    UPDATE movimientos SET
      nombre = COALESCE(${p.nombre ?? null}, nombre),
      categoria = COALESCE(${p.categoria ?? null}, categoria),
      pagador = COALESCE(${p.pagador ?? null}, pagador),
      moneda = COALESCE(${p.moneda ?? null}, moneda),
      monto_centavos = COALESCE(${p.monto ?? null}, monto_centavos),
      vencimiento = CASE WHEN ${p.vencimiento !== undefined} THEN ${p.vencimiento ?? null} ELSE vencimiento END,
      pagado = COALESCE(${p.pagado ?? null}, pagado),
      fecha_pago = CASE WHEN ${p.fechaPago !== undefined} THEN ${p.fechaPago ?? null} ELSE fecha_pago END,
      medio_pago = CASE WHEN ${p.medioPago !== undefined} THEN ${p.medioPago ?? null} ELSE medio_pago END,
      notas = CASE WHEN ${p.notas !== undefined} THEN ${p.notas ?? null} ELSE notas END
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
