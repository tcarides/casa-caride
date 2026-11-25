import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

// Regalos de Navidad: tablero familiar de listas de deseos.
//  - grupos         → cada festejo/familia (se crean desde la app).
//  - participantes  → personas del grupo, por nombre (pueden no tener usuario).
//  - deseos         → ítems de la lista de cada participante (texto o link).
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

export interface Deseo {
  id: number
  participanteId: number
  titulo: string
  link: string | null
  imagenUrl: string | null
  precio: number | null // centavos
  moneda: Moneda
  prioridad: Prioridad
  nota: string | null
  createdAt: string
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
  await sql`CREATE INDEX IF NOT EXISTS participantes_grupo ON participantes (grupo_id)`
  await sql`CREATE INDEX IF NOT EXISTS deseos_participante ON deseos (participante_id)`
  schemaReady = true
}

// ── Grupos ──
export async function listGrupos(): Promise<Grupo[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT g.id, g.nombre, g.created_at,
           COUNT(DISTINCT p.id)::int AS n_participantes,
           COUNT(d.id)::int AS n_deseos
    FROM grupos g
    LEFT JOIN participantes p ON p.grupo_id = g.id
    LEFT JOIN deseos d ON d.participante_id = p.id
    GROUP BY g.id, g.nombre, g.created_at
    ORDER BY g.created_at ASC, g.id ASC`
  return rows.map((r) => ({
    id: Number(r.id),
    nombre: r.nombre as string,
    createdAt: toIso(r.created_at),
    nParticipantes: Number(r.n_participantes),
    nDeseos: Number(r.n_deseos),
  }))
}

export async function createGrupo(nombre: string): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [row] = await sql`INSERT INTO grupos (nombre) VALUES (${nombre}) RETURNING id`
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
  await sql`DELETE FROM grupos WHERE id = ${id}` // cascade borra participantes y deseos
}

// Prioridad para ordenar: alta → media → baja.
const PRIO_ORDER: Record<string, number> = { alta: 0, media: 1, baja: 2 }

/** Grupo completo: participantes (por orden) con sus deseos (por prioridad). */
export async function getGrupoDetalle(id: number): Promise<GrupoDetalle | null> {
  await ensureSchema()
  const sql = getSql()
  const grupos = await sql`SELECT id, nombre, created_at FROM grupos WHERE id = ${id}`
  if (!grupos.length) return null
  const g = grupos[0]

  const parts = await sql`
    SELECT id, grupo_id, nombre, emoji, orden, created_at
    FROM participantes WHERE grupo_id = ${id}
    ORDER BY orden ASC, created_at ASC, id ASC`
  const deseos = await sql`
    SELECT d.id, d.participante_id, d.titulo, d.link, d.imagen_url, d.precio_centavos,
           d.moneda, d.prioridad, d.nota, d.created_at
    FROM deseos d
    JOIN participantes p ON p.id = d.participante_id
    WHERE p.grupo_id = ${id}`

  const byParticipante = new Map<number, Deseo[]>()
  for (const r of deseos) {
    const pid = Number(r.participante_id)
    const list = byParticipante.get(pid) ?? []
    list.push(mapDeseo(r))
    byParticipante.set(pid, list)
  }
  for (const list of byParticipante.values()) {
    list.sort((a, b) =>
      (PRIO_ORDER[a.prioridad] ?? 1) - (PRIO_ORDER[b.prioridad] ?? 1) ||
      a.createdAt.localeCompare(b.createdAt))
  }

  return {
    id: Number(g.id),
    nombre: g.nombre as string,
    createdAt: toIso(g.created_at),
    participantes: parts.map((p) => ({
      id: Number(p.id),
      grupoId: Number(p.grupo_id),
      nombre: p.nombre as string,
      emoji: (p.emoji as string | null) ?? null,
      orden: Number(p.orden),
      deseos: byParticipante.get(Number(p.id)) ?? [],
    })),
  }
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
  await sql`DELETE FROM participantes WHERE id = ${id}` // cascade borra sus deseos
}

// ── Deseos ──
function mapDeseo(r: Record<string, unknown>): Deseo {
  return {
    id: Number(r.id),
    participanteId: Number(r.participante_id),
    titulo: r.titulo as string,
    link: (r.link as string | null) ?? null,
    imagenUrl: (r.imagen_url as string | null) ?? null,
    precio: r.precio_centavos == null ? null : Number(r.precio_centavos),
    moneda: (r.moneda as Moneda) ?? 'ARS',
    prioridad: (r.prioridad as Prioridad) ?? 'media',
    nota: (r.nota as string | null) ?? null,
    createdAt: toIso(r.created_at),
  }
}

export interface DeseoInput {
  titulo: string
  link: string | null
  imagenUrl: string | null
  precio: number | null
  moneda: Moneda
  prioridad: Prioridad
  nota: string | null
}

export async function addDeseo(participanteId: number, d: DeseoInput): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO deseos
      (participante_id, titulo, link, imagen_url, precio_centavos, moneda, prioridad, nota)
    VALUES
      (${participanteId}, ${d.titulo}, ${d.link}, ${d.imagenUrl}, ${d.precio}, ${d.moneda}, ${d.prioridad}, ${d.nota})
    RETURNING id`
  return Number(row.id)
}

export interface DeseoPatch {
  titulo?: string
  link?: string | null
  imagenUrl?: string | null
  precio?: number | null
  moneda?: Moneda
  prioridad?: Prioridad
  nota?: string | null
}

export async function updateDeseo(id: number, p: DeseoPatch): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    UPDATE deseos SET
      titulo = COALESCE(${p.titulo ?? null}, titulo),
      link = CASE WHEN ${p.link !== undefined} THEN ${p.link ?? null} ELSE link END,
      imagen_url = CASE WHEN ${p.imagenUrl !== undefined} THEN ${p.imagenUrl ?? null} ELSE imagen_url END,
      precio_centavos = CASE WHEN ${p.precio !== undefined} THEN ${p.precio ?? null} ELSE precio_centavos END,
      moneda = COALESCE(${p.moneda ?? null}, moneda),
      prioridad = COALESCE(${p.prioridad ?? null}, prioridad),
      nota = CASE WHEN ${p.nota !== undefined} THEN ${p.nota ?? null} ELSE nota END
    WHERE id = ${id}`
}

export async function deleteDeseo(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM deseos WHERE id = ${id}`
}
