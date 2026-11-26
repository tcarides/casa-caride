import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { randomUUID } from 'node:crypto'

function nuevoToken(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

// Regalos de Navidad: tablero familiar de listas de deseos.
//  - grupos         → cada festejo/familia (se crean desde la app).
//  - participantes  → personas del grupo, por nombre (pueden no tener usuario).
//  - deseos         → "lo que quiere" cada persona (título + prioridad + nota).
//  - opciones       → alternativas concretas de un deseo (link, imagen, precio).
// Precios en centavos (enteros). Moneda ARS o USD. Cualquier usuario logueado
// puede ver y editar todo (las mamás cargan lo de los hijos, etc.).

type Sql = NeonQueryFunction<false, false>
let _sql: Sql | undefined

export function getSql(): Sql {
  if (_sql) return _sql
  const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL
  if (!conn) throw new Error('Falta DATABASE_URL (Neon de Regalos de Navidad).')
  _sql = neon(conn)
  return _sql
}

export type Moneda = 'ARS' | 'USD'
export type Prioridad = 'alta' | 'media' | 'baja'

// Neon/pg devuelve TIMESTAMPTZ como objeto Date (no string). Normalizamos a
// ISO para que el tipo `createdAt: string` sea verdad en runtime y los sorts
// (localeCompare) y el formateo en el cliente funcionen.
function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

// Prioridad para ordenar: alta → media → baja.
const PRIO_ORDER: Record<string, number> = { alta: 0, media: 1, baja: 2 }

export interface Opcion {
  id: number
  deseoId: number
  titulo: string | null       // etiqueta de la opción (tienda, modelo…)
  link: string | null
  imagenUrl: string | null
  precio: number | null       // centavos
  moneda: Moneda
  nota: string | null
  orden: number
}

export interface Deseo {
  id: number
  participanteId: number
  titulo: string
  prioridad: Prioridad
  nota: string | null
  createdAt: string
  opcionElegidaId: number | null  // opción "principal"; null → la primera (A)
  opciones: Opcion[]
}

export interface Participante {
  id: number
  grupoId: number
  nombre: string
  emoji: string | null
  orden: number
  deseos: Deseo[]
}

export interface Grupo {
  id: number
  nombre: string
  token: string          // token para el link público de solo lectura
  createdAt: string
  nParticipantes?: number
  nDeseos?: number
}

export interface GrupoDetalle extends Grupo {
  participantes: Participante[]
}

// ── Schema ──
let schemaReady = false
export async function ensureSchema(): Promise<void> {
  if (schemaReady) return
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS grupos (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS participantes (
      id BIGSERIAL PRIMARY KEY,
      grupo_id BIGINT NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      emoji TEXT,
      orden INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  // La tabla deseos conserva columnas link/imagen/precio por compatibilidad y
  // para la migración; el modelo nuevo guarda eso en `opciones`.
  await sql`
    CREATE TABLE IF NOT EXISTS deseos (
      id BIGSERIAL PRIMARY KEY,
      participante_id BIGINT NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      link TEXT,
      imagen_url TEXT,
      precio_centavos BIGINT,
      moneda TEXT NOT NULL DEFAULT 'ARS',
      prioridad TEXT NOT NULL DEFAULT 'media',
      nota TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS opciones (
      id BIGSERIAL PRIMARY KEY,
      deseo_id BIGINT NOT NULL REFERENCES deseos(id) ON DELETE CASCADE,
      titulo TEXT,
      link TEXT,
      imagen_url TEXT,
      precio_centavos BIGINT,
      moneda TEXT NOT NULL DEFAULT 'ARS',
      nota TEXT,
      orden INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS participantes_grupo ON participantes (grupo_id)`
  await sql`CREATE INDEX IF NOT EXISTS deseos_participante ON deseos (participante_id)`
  await sql`CREATE INDEX IF NOT EXISTS opciones_deseo ON opciones (deseo_id)`
  // Opción "principal" de cada deseo (la que se muestra como foto/precio).
  // null → se usa la primera (A). Si se borra esa opción, vuelve a null.
  await sql`ALTER TABLE deseos ADD COLUMN IF NOT EXISTS opcion_elegida_id BIGINT REFERENCES opciones(id) ON DELETE SET NULL`
  // Token para el link público de solo lectura (compartir por WhatsApp).
  await sql`ALTER TABLE grupos ADD COLUMN IF NOT EXISTS token TEXT`
  await sql`UPDATE grupos SET token = substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 12) WHERE token IS NULL OR token = ''`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS grupos_token ON grupos (token)`
  // Migración idempotente: cada deseo viejo con link/imagen/precio y sin
  // opciones pasa a tener esa info como su primera opción.
  await sql`
    INSERT INTO opciones (deseo_id, link, imagen_url, precio_centavos, moneda, orden)
    SELECT d.id, d.link, d.imagen_url, d.precio_centavos, COALESCE(d.moneda, 'ARS'), 0
    FROM deseos d
    WHERE (d.link IS NOT NULL OR d.precio_centavos IS NOT NULL OR d.imagen_url IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM opciones o WHERE o.deseo_id = d.id)
  `
  schemaReady = true
}

// ── Grupos ──
export async function listGrupos(): Promise<Grupo[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT g.id, g.nombre, g.token, g.created_at,
           COUNT(DISTINCT p.id)::int AS n_participantes,
           COUNT(DISTINCT d.id)::int AS n_deseos
    FROM grupos g
    LEFT JOIN participantes p ON p.grupo_id = g.id
    LEFT JOIN deseos d ON d.participante_id = p.id
    GROUP BY g.id, g.nombre, g.token, g.created_at
    ORDER BY g.created_at ASC, g.id ASC`
  return rows.map((r) => ({
    id: Number(r.id),
    nombre: r.nombre as string,
    token: (r.token as string) ?? '',
    createdAt: toIso(r.created_at),
    nParticipantes: Number(r.n_participantes),
    nDeseos: Number(r.n_deseos),
  }))
}

export async function createGrupo(nombre: string): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [row] = await sql`INSERT INTO grupos (nombre, token) VALUES (${nombre}, ${nuevoToken()}) RETURNING id`
  return Number(row.id)
}

export async function renameGrupo(id: number, nombre: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`UPDATE grupos SET nombre = ${nombre} WHERE id = ${id}`
}

export async function deleteGrupo(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM grupos WHERE id = ${id}` // cascade borra participantes, deseos y opciones
}

/** Grupo completo: participantes (por orden) con deseos (por prioridad) y sus opciones. */
export async function getGrupoDetalle(id: number): Promise<GrupoDetalle | null> {
  await ensureSchema()
  const sql = getSql()
  const grupos = await sql`SELECT id, nombre, token, created_at FROM grupos WHERE id = ${id}`
  if (!grupos.length) return null
  const g = grupos[0]

  const parts = await sql`
    SELECT id, grupo_id, nombre, emoji, orden, created_at
    FROM participantes WHERE grupo_id = ${id}
    ORDER BY orden ASC, created_at ASC, id ASC`
  const deseosRows = await sql`
    SELECT d.id, d.participante_id, d.titulo, d.prioridad, d.nota, d.opcion_elegida_id, d.created_at
    FROM deseos d
    JOIN participantes p ON p.id = d.participante_id
    WHERE p.grupo_id = ${id}`
  const opcionesRows = await sql`
    SELECT o.id, o.deseo_id, o.titulo, o.link, o.imagen_url, o.precio_centavos, o.moneda, o.nota, o.orden
    FROM opciones o
    JOIN deseos d ON d.id = o.deseo_id
    JOIN participantes p ON p.id = d.participante_id
    WHERE p.grupo_id = ${id}
    ORDER BY o.orden ASC, o.id ASC`

  const opcByDeseo = new Map<number, Opcion[]>()
  for (const r of opcionesRows) {
    const did = Number(r.deseo_id)
    const list = opcByDeseo.get(did) ?? []
    list.push(mapOpcion(r))
    opcByDeseo.set(did, list)
  }

  const deseosByPart = new Map<number, Deseo[]>()
  for (const r of deseosRows) {
    const pid = Number(r.participante_id)
    const list = deseosByPart.get(pid) ?? []
    list.push({
      id: Number(r.id),
      participanteId: pid,
      titulo: r.titulo as string,
      prioridad: (r.prioridad as Prioridad) ?? 'media',
      nota: (r.nota as string | null) ?? null,
      createdAt: toIso(r.created_at),
      opcionElegidaId: r.opcion_elegida_id == null ? null : Number(r.opcion_elegida_id),
      opciones: opcByDeseo.get(Number(r.id)) ?? [],
    })
    deseosByPart.set(pid, list)
  }
  for (const list of deseosByPart.values()) {
    list.sort((a, b) =>
      (PRIO_ORDER[a.prioridad] ?? 1) - (PRIO_ORDER[b.prioridad] ?? 1) ||
      a.createdAt.localeCompare(b.createdAt))
  }

  const participantes = parts.map((p) => ({
    id: Number(p.id),
    grupoId: Number(p.grupo_id),
    nombre: p.nombre as string,
    emoji: (p.emoji as string | null) ?? null,
    orden: Number(p.orden),
    deseos: deseosByPart.get(Number(p.id)) ?? [],
  }))
  // Personas ordenadas alfabéticamente (es: respeta acentos, ñ y mayúsculas).
  participantes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))

  return {
    id: Number(g.id),
    nombre: g.nombre as string,
    token: (g.token as string) ?? '',
    createdAt: toIso(g.created_at),
    participantes,
  }
}

/** Grupo completo por su token público (para la vista de solo lectura). */
export async function getGrupoByToken(token: string): Promise<GrupoDetalle | null> {
  if (!token) return null
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT id FROM grupos WHERE token = ${token}`
  if (!rows.length) return null
  return getGrupoDetalle(Number(rows[0].id))
}

// ── Participantes ──
export async function addParticipante(grupoId: number, nombre: string, emoji: string | null): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [{ n }] = (await sql`SELECT COALESCE(MAX(orden), -1) + 1 AS n FROM participantes WHERE grupo_id = ${grupoId}`) as { n: number }[]
  const [row] = await sql`
    INSERT INTO participantes (grupo_id, nombre, emoji, orden)
    VALUES (${grupoId}, ${nombre}, ${emoji}, ${Number(n)})
    RETURNING id`
  return Number(row.id)
}

export interface ParticipantePatch { nombre?: string; emoji?: string | null }

export async function updateParticipante(id: number, p: ParticipantePatch): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    UPDATE participantes SET
      nombre = COALESCE(${p.nombre ?? null}, nombre),
      emoji = CASE WHEN ${p.emoji !== undefined} THEN ${p.emoji ?? null} ELSE emoji END
    WHERE id = ${id}`
}

export async function deleteParticipante(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM participantes WHERE id = ${id}` // cascade borra deseos y opciones
}

// ── Deseos ──
export interface DeseoInput {
  titulo: string
  prioridad: Prioridad
  nota: string | null
  opciones?: OpcionInput[]
}

export async function addDeseo(participanteId: number, d: DeseoInput): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO deseos (participante_id, titulo, prioridad, nota)
    VALUES (${participanteId}, ${d.titulo}, ${d.prioridad}, ${d.nota})
    RETURNING id`
  const deseoId = Number(row.id)
  const opciones = d.opciones ?? []
  for (let i = 0; i < opciones.length; i++) {
    await insertOpcion(sql, deseoId, opciones[i], i)
  }
  return deseoId
}

export interface DeseoPatch {
  titulo?: string
  prioridad?: Prioridad
  nota?: string | null
  opcionElegidaId?: number | null
}

export async function updateDeseo(id: number, p: DeseoPatch): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    UPDATE deseos SET
      titulo = COALESCE(${p.titulo ?? null}, titulo),
      prioridad = COALESCE(${p.prioridad ?? null}, prioridad),
      nota = CASE WHEN ${p.nota !== undefined} THEN ${p.nota ?? null} ELSE nota END,
      opcion_elegida_id = CASE WHEN ${p.opcionElegidaId !== undefined} THEN ${p.opcionElegidaId ?? null} ELSE opcion_elegida_id END
    WHERE id = ${id}`
}

export async function deleteDeseo(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM deseos WHERE id = ${id}` // cascade borra opciones
}

// ── Opciones ──
export interface OpcionInput {
  titulo: string | null
  link: string | null
  imagenUrl: string | null
  precio: number | null
  moneda: Moneda
  nota: string | null
}

function mapOpcion(r: Record<string, unknown>): Opcion {
  return {
    id: Number(r.id),
    deseoId: Number(r.deseo_id),
    titulo: (r.titulo as string | null) ?? null,
    link: (r.link as string | null) ?? null,
    imagenUrl: (r.imagen_url as string | null) ?? null,
    precio: r.precio_centavos == null ? null : Number(r.precio_centavos),
    moneda: (r.moneda as Moneda) ?? 'ARS',
    nota: (r.nota as string | null) ?? null,
    orden: Number(r.orden),
  }
}

async function insertOpcion(sql: Sql, deseoId: number, o: OpcionInput, orden: number): Promise<number> {
  const [row] = await sql`
    INSERT INTO opciones
      (deseo_id, titulo, link, imagen_url, precio_centavos, moneda, nota, orden)
    VALUES
      (${deseoId}, ${o.titulo}, ${o.link}, ${o.imagenUrl}, ${o.precio}, ${o.moneda}, ${o.nota}, ${orden})
    RETURNING id`
  return Number(row.id)
}

export async function addOpcion(deseoId: number, o: OpcionInput): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [{ n }] = (await sql`SELECT COALESCE(MAX(orden), -1) + 1 AS n FROM opciones WHERE deseo_id = ${deseoId}`) as { n: number }[]
  return insertOpcion(sql, deseoId, o, Number(n))
}

export interface OpcionPatch {
  titulo?: string | null
  link?: string | null
  imagenUrl?: string | null
  precio?: number | null
  moneda?: Moneda
  nota?: string | null
}

export async function updateOpcion(id: number, p: OpcionPatch): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    UPDATE opciones SET
      titulo = CASE WHEN ${p.titulo !== undefined} THEN ${p.titulo ?? null} ELSE titulo END,
      link = CASE WHEN ${p.link !== undefined} THEN ${p.link ?? null} ELSE link END,
      imagen_url = CASE WHEN ${p.imagenUrl !== undefined} THEN ${p.imagenUrl ?? null} ELSE imagen_url END,
      precio_centavos = CASE WHEN ${p.precio !== undefined} THEN ${p.precio ?? null} ELSE precio_centavos END,
      moneda = COALESCE(${p.moneda ?? null}, moneda),
      nota = CASE WHEN ${p.nota !== undefined} THEN ${p.nota ?? null} ELSE nota END
    WHERE id = ${id}`
}

export async function deleteOpcion(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM opciones WHERE id = ${id}`
}
