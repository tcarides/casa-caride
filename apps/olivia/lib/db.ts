import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let _sql: NeonQueryFunction<false, false> | null = null

function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL
  if (!url) throw new Error('Falta DATABASE_URL / POSTGRES_URL')
  _sql = neon(url)
  return _sql
}

/* ── Items por defecto del checklist (se siembran la primera vez) ─────────── */
const DEFAULT_CHECKLIST: { tri: string; text: string }[] = [
  { tri: '1° trimestre', text: 'Elegir obstetra o partera y agendar controles' },
  { tri: '1° trimestre', text: 'Comenzar suplementos (ácido fólico, hierro si indican)' },
  { tri: '1° trimestre', text: 'Ecografía del primer trimestre' },
  { tri: '1° trimestre', text: 'Avisar en el trabajo y averiguar licencias' },
  { tri: '2° trimestre', text: 'Ecografía morfológica (semana 20)' },
  { tri: '2° trimestre', text: 'Anotarse en curso de preparación para el parto' },
  { tri: '2° trimestre', text: 'Definir nombre y empezar la habitación' },
  { tri: '2° trimestre', text: 'Trámites de obra social / prepaga para Olivia' },
  { tri: '2° trimestre', text: 'Comprar lo grande: cuna, cochecito, silla de auto' },
  { tri: '3° trimestre', text: 'Test de diabetes gestacional' },
  { tri: '3° trimestre', text: 'Instalar y probar la silla de auto' },
  { tri: '3° trimestre', text: 'Armar el bolso del hospital (mamá, bebé y papá)' },
  { tri: '3° trimestre', text: 'Lavar y guardar la ropita de recién nacido' },
  { tri: '3° trimestre', text: 'Escribir el plan de parto y repasarlo con el equipo' },
  { tri: '3° trimestre', text: 'Definir el camino al hospital y a quién llamar' },
  { tri: '3° trimestre', text: 'Cocinar y congelar comidas para las primeras semanas' },
  { tri: '3° trimestre', text: 'Inscribir cobertura médica y documentos listos' },
]

const DEFAULT_DUE = '2026-08-05'
const DEFAULT_NAME = 'Olivia'

let schemaReady = false
async function ensureSchema() {
  if (schemaReady) return
  const sql = getSql()

  await sql`
    CREATE TABLE IF NOT EXISTS olivia_config (
      id        INT  PRIMARY KEY DEFAULT 1,
      due_date  DATE NOT NULL,
      baby_name TEXT NOT NULL,
      CHECK (id = 1)
    )
  `
  await sql`
    INSERT INTO olivia_config (id, due_date, baby_name)
    VALUES (1, ${DEFAULT_DUE}::date, ${DEFAULT_NAME})
    ON CONFLICT (id) DO NOTHING
  `
  await sql`
    CREATE TABLE IF NOT EXISTS olivia_checklist (
      id         SERIAL      PRIMARY KEY,
      tri        TEXT        NOT NULL DEFAULT '',
      text       TEXT        NOT NULL,
      done       BOOLEAN     NOT NULL DEFAULT FALSE,
      sort       INT         NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS olivia_estudios (
      id           SERIAL      PRIMARY KEY,
      fecha        DATE        NOT NULL,
      titulo       TEXT        NOT NULL,
      tipo         TEXT        NOT NULL DEFAULT 'otro',
      blob_url     TEXT        NOT NULL,
      pathname     TEXT        NOT NULL DEFAULT '',
      content_type TEXT        NOT NULL DEFAULT '',
      size         BIGINT      NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS olivia_turnos (
      id          SERIAL      PRIMARY KEY,
      fecha       TIMESTAMPTZ NOT NULL,
      profesional TEXT        NOT NULL DEFAULT '',
      motivo      TEXT        NOT NULL DEFAULT '',
      notas       TEXT        NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS olivia_mediciones (
      id         SERIAL      PRIMARY KEY,
      fecha      DATE        NOT NULL,
      tipo       TEXT        NOT NULL,
      valor      TEXT        NOT NULL,
      unidad     TEXT        NOT NULL DEFAULT '',
      notas      TEXT        NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS olivia_notas (
      id         SERIAL      PRIMARY KEY,
      fecha      DATE        NOT NULL,
      categoria  TEXT        NOT NULL DEFAULT 'nota',
      texto      TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Seed del checklist solo si está vacío.
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM olivia_checklist` as { count: number }[]
  if (count === 0) {
    for (let i = 0; i < DEFAULT_CHECKLIST.length; i++) {
      const item = DEFAULT_CHECKLIST[i]
      await sql`INSERT INTO olivia_checklist (tri, text, sort) VALUES (${item.tri}, ${item.text}, ${i})`
    }
  }

  schemaReady = true
}

/* ── Tipos ────────────────────────────────────────────────────────────────── */
export interface Config       { dueDate: string; babyName: string }
export interface ChecklistItem { id: number; tri: string; text: string; done: boolean }
export interface Estudio      { id: number; fecha: string; titulo: string; tipo: string; blobUrl: string; contentType: string; size: number }
export interface Turno        { id: number; fecha: string; profesional: string; motivo: string; notas: string }
export interface Medicion     { id: number; fecha: string; tipo: string; valor: string; unidad: string; notas: string }
export interface Nota         { id: number; fecha: string; categoria: string; texto: string }

/* ── Config ───────────────────────────────────────────────────────────────── */
export async function getConfig(): Promise<Config> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT to_char(due_date, 'YYYY-MM-DD') AS due_date, baby_name FROM olivia_config WHERE id = 1` as { due_date: string; baby_name: string }[]
  return { dueDate: rows[0]?.due_date ?? DEFAULT_DUE, babyName: rows[0]?.baby_name ?? DEFAULT_NAME }
}

export async function setConfig(dueDate: string, babyName: string): Promise<Config> {
  await ensureSchema()
  const sql = getSql()
  await sql`UPDATE olivia_config SET due_date = ${dueDate}::date, baby_name = ${babyName} WHERE id = 1`
  return getConfig()
}

/* ── Checklist ────────────────────────────────────────────────────────────── */
export async function getChecklist(): Promise<ChecklistItem[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT id, tri, text, done FROM olivia_checklist ORDER BY sort ASC, id ASC` as ChecklistItem[]
  return rows
}

export async function addChecklistItem(text: string, tri: string): Promise<ChecklistItem> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    INSERT INTO olivia_checklist (tri, text, sort)
    VALUES (${tri}, ${text}, (SELECT COALESCE(MAX(sort), 0) + 1 FROM olivia_checklist))
    RETURNING id, tri, text, done
  ` as ChecklistItem[]
  return rows[0]
}

export async function toggleChecklistItem(id: number, done: boolean): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`UPDATE olivia_checklist SET done = ${done} WHERE id = ${id}`
}

export async function deleteChecklistItem(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM olivia_checklist WHERE id = ${id}`
}

/* ── Estudios ─────────────────────────────────────────────────────────────── */
export async function getEstudios(): Promise<Estudio[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, titulo, tipo,
           blob_url AS "blobUrl", content_type AS "contentType", size
    FROM olivia_estudios ORDER BY fecha DESC, id DESC
  ` as Estudio[]
  return rows
}

export async function addEstudio(e: {
  fecha: string; titulo: string; tipo: string; blobUrl: string; pathname: string; contentType: string; size: number
}): Promise<Estudio> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    INSERT INTO olivia_estudios (fecha, titulo, tipo, blob_url, pathname, content_type, size)
    VALUES (${e.fecha}::date, ${e.titulo}, ${e.tipo}, ${e.blobUrl}, ${e.pathname}, ${e.contentType}, ${e.size})
    RETURNING id, to_char(fecha, 'YYYY-MM-DD') AS fecha, titulo, tipo,
              blob_url AS "blobUrl", content_type AS "contentType", size
  ` as Estudio[]
  return rows[0]
}

export async function getEstudioUrl(id: number): Promise<string | null> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT blob_url FROM olivia_estudios WHERE id = ${id}` as { blob_url: string }[]
  return rows[0]?.blob_url ?? null
}

export async function deleteEstudio(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM olivia_estudios WHERE id = ${id}`
}

/* ── Turnos ───────────────────────────────────────────────────────────────── */
export async function getTurnos(): Promise<Turno[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT id, to_char(fecha, 'YYYY-MM-DD"T"HH24:MI') AS fecha, profesional, motivo, notas
    FROM olivia_turnos ORDER BY fecha DESC, id DESC
  ` as Turno[]
  return rows
}

export async function addTurno(t: { fecha: string; profesional: string; motivo: string; notas: string }): Promise<Turno> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    INSERT INTO olivia_turnos (fecha, profesional, motivo, notas)
    VALUES (${t.fecha}::timestamptz, ${t.profesional}, ${t.motivo}, ${t.notas})
    RETURNING id, to_char(fecha, 'YYYY-MM-DD"T"HH24:MI') AS fecha, profesional, motivo, notas
  ` as Turno[]
  return rows[0]
}

export async function deleteTurno(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM olivia_turnos WHERE id = ${id}`
}

/* ── Mediciones ───────────────────────────────────────────────────────────── */
export async function getMediciones(): Promise<Medicion[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, tipo, valor, unidad, notas
    FROM olivia_mediciones ORDER BY fecha DESC, id DESC
  ` as Medicion[]
  return rows
}

export async function addMedicion(m: { fecha: string; tipo: string; valor: string; unidad: string; notas: string }): Promise<Medicion> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    INSERT INTO olivia_mediciones (fecha, tipo, valor, unidad, notas)
    VALUES (${m.fecha}::date, ${m.tipo}, ${m.valor}, ${m.unidad}, ${m.notas})
    RETURNING id, to_char(fecha, 'YYYY-MM-DD') AS fecha, tipo, valor, unidad, notas
  ` as Medicion[]
  return rows[0]
}

export async function deleteMedicion(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM olivia_mediciones WHERE id = ${id}`
}

/* ── Notas ────────────────────────────────────────────────────────────────── */
export async function getNotas(): Promise<Nota[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, categoria, texto
    FROM olivia_notas ORDER BY fecha DESC, id DESC
  ` as Nota[]
  return rows
}

export async function addNota(n: { fecha: string; categoria: string; texto: string }): Promise<Nota> {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    INSERT INTO olivia_notas (fecha, categoria, texto)
    VALUES (${n.fecha}::date, ${n.categoria}, ${n.texto})
    RETURNING id, to_char(fecha, 'YYYY-MM-DD') AS fecha, categoria, texto
  ` as Nota[]
  return rows[0]
}

export async function deleteNota(id: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM olivia_notas WHERE id = ${id}`
}
