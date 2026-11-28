import { canSeeResource, planLinks, type DirectoryUser } from '@casa/people'
import { ensureSchema, getSql } from './db'
import { fetchDirectory, fetchJoinHints, type DirUserRole, type JoinHint } from './directory'
import { grantGrupoAccess } from './access'

// Corre una vez con el directorio (cualquier logueado) y se completa cuando
// entra un admin, que es quien puede leer invitaciones ya usadas. Es
// idempotente: no pisa un email ya puesto.

interface Meta { withRoles?: boolean }

let memoryDone = false

export async function ensureBackfill(cookie: string, role: string): Promise<void> {
  if (memoryDone) return
  await ensureSchema()
  const meta = await readMeta()
  if (meta?.withRoles) {
    memoryDone = true
    return
  }
  if (!meta) {
    const directory = await fetchDirectory(cookie)
    if (!directory?.length) return
    await applyPeople(directory)
    await saveReport(directory.map((u) => ({ ...u, role: 'member' })), [], false)
  }
  if (role !== 'admin') return
  const packed = await fetchJoinHints(cookie)
  if (!packed) return
  await applyInvites(packed.hints, packed.users)
  await saveReport(packed.users, packed.hints, true)
  memoryDone = true
}

async function applyPeople(users: DirectoryUser[]): Promise<void> {
  const sql = getSql()
  const rows = await sql`
    SELECT p.id, p.nombre AS label, p.user_email, g.nombre AS context
    FROM participantes p JOIN grupos g ON g.id = p.grupo_id
  `
  const people = rows.map((r) => ({
    id: Number(r.id),
    label: r.label as string,
    userEmail: (r.user_email as string | null) ?? null,
    context: r.context as string,
  }))
  const plan = planLinks(people, users)
  for (const row of plan.link) {
    await sql`
      UPDATE participantes SET user_email = ${row.hit.email}
      WHERE id = ${row.id} AND (user_email IS NULL OR user_email = '')
    `
  }
}

async function applyInvites(hints: JoinHint[], users: DirUserRole[]): Promise<void> {
  const names = new Map(users.map((u) => [u.email.toLowerCase(), u.name]))
  const sql = getSql()
  for (const hint of hints) {
    if (hint.app !== 'navidad') continue
    const email = hint.email.toLowerCase()
    let grupoId: number | null = null
    if (hint.token) {
      const rows = await sql`SELECT id FROM grupos WHERE token = ${hint.token}`
      if (rows.length === 1) grupoId = Number(rows[0].id)
    } else if (hint.nombre) {
      const rows = await sql`SELECT id FROM grupos WHERE lower(nombre) = ${hint.nombre.trim().toLowerCase()}`
      if (rows.length === 1) grupoId = Number(rows[0].id)
    }
    if (grupoId == null) continue
    await grantGrupoAccess(grupoId, email, names.get(email) ?? email, 'invitacion')
  }
}

async function snapshot(users: { email: string; name: string; role: string }[]) {
  const sql = getSql()
  const grupos = await sql`SELECT id, nombre, owner_email FROM grupos ORDER BY nombre ASC`
  const acceso = await sql`SELECT grupo_id, email FROM grupo_acceso`
  const links = await sql`SELECT grupo_id, user_email FROM participantes WHERE user_email IS NOT NULL`
  const byGrupo = new Map<number, { name: string; ownerEmail: string | null; emails: string[] }>()
  for (const g of grupos) {
    byGrupo.set(Number(g.id), {
      name: g.nombre as string,
      ownerEmail: (g.owner_email as string | null) ?? null,
      emails: [],
    })
  }
  for (const row of [...acceso, ...links.map((r) => ({ grupo_id: r.grupo_id, email: r.user_email }))]) {
    const item = byGrupo.get(Number(row.grupo_id))
    const email = (row.email as string | null)?.toLowerCase()
    if (item && email && !item.emails.includes(email)) item.emails.push(email)
  }
  return users.map((u) => ({
    email: u.email,
    name: u.name,
    role: u.role,
    listas: [...byGrupo.values()]
      .filter((g) => canSeeResource({
        email: u.email,
        role: u.role,
        ownerEmail: g.ownerEmail,
        memberEmails: g.emails,
      }))
      .map((g) => g.name),
  }))
}

async function saveReport(
  users: { email: string; name: string; role: string }[],
  hints: JoinHint[],
  withRoles: boolean,
): Promise<void> {
  const sql = getSql()
  const rows = await sql`
    SELECT p.id, p.nombre AS label, p.user_email, g.nombre AS context,
           EXISTS (SELECT 1 FROM deseos d WHERE d.participante_id = p.id) AS con_deseos
    FROM participantes p JOIN grupos g ON g.id = p.grupo_id
    ORDER BY g.nombre, p.nombre
  `
  const people = rows.map((r) => ({
    id: Number(r.id),
    label: r.label as string,
    userEmail: (r.user_email as string | null) ?? null,
    context: r.context as string,
    conDeseos: r.con_deseos === true,
  }))
  const fresh = people.map((p) => ({ ...p, userEmail: null as string | null }))
  const plan = planLinks(fresh, users)
  const linkedNow = new Map(people.filter((p) => p.userEmail).map((p) => [p.id, p.userEmail]))
  const vis = await snapshot(users)
  const report = {
    withRoles,
    ranAt: new Date().toISOString(),
    directorio: users.map((u) => ({ name: u.name, email: u.email, role: u.role })),
    vinculados: plan.link
      .filter((p) => linkedNow.get(p.id)?.toLowerCase() === p.hit.email)
      .map((p) => ({
        apodo: p.label,
        lista: p.context,
        usuario: p.hit.name,
        email: p.hit.email,
        porque: p.hit.reason,
        teniaDeseos: people.find((x) => x.id === p.id)?.conDeseos === true,
      })),
    yaEstaban: people.filter((p) => p.userEmail && !plan.link.some((l) => l.id === p.id && l.hit.email === p.userEmail?.toLowerCase())).map((p) => ({
      apodo: p.label, lista: p.context, email: p.userEmail,
    })),
    ambiguos: plan.ambiguous.map((p) => ({
      apodo: p.label,
      lista: p.context,
      candidatos: p.candidates.map((c) => `${c.name} <${c.email}>`),
    })),
    sinMatch: plan.unmatched.map((p) => ({ apodo: p.label, lista: p.context })),
    invitaciones: hints.filter((h) => h.app === 'navidad'),
    quienVe: vis,
  }
  await sql`
    INSERT INTO acceso_meta (k, v) VALUES ('people_v1', ${JSON.stringify(report)}::jsonb)
    ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()
  `
}

async function readMeta(): Promise<Meta | null> {
  const rows = await getSql()`SELECT v FROM acceso_meta WHERE k = 'people_v1'`
  if (!rows.length) return null
  const v = rows[0].v as Meta
  return v && typeof v === 'object' ? v : null
}
