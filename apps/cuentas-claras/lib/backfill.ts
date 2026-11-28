import { canSeeResource, planLinks, type DirectoryUser } from '@casa/people'
import { ensureSchema, getSql } from './db'
import { fetchDirectory, fetchJoinHints, type DirUserRole, type JoinHint } from './directory'
import { grantCuentaAccess, grantGrupoAccess } from './access'

// Nombres sueltos (participantes de una cuenta, contactos de un grupo) se
// vinculan solo cuando hay una coincidencia única con el directorio. No pisa
// un email que ya estaba. Las invitaciones usadas las completa un admin.

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

interface Named {
  id: number
  label: string
  userEmail: string | null
  context: string
  kind: 'cuenta' | 'grupo'
  payer: boolean
}

async function loadPeople(): Promise<Named[]> {
  const sql = getSql()
  const cuentas = await sql`
    SELECT p.id, p.name AS label, p.user_email, c.name AS context,
           EXISTS (SELECT 1 FROM gastos g WHERE g.pagador_id = p.id) AS payer
    FROM participantes p JOIN cuentas c ON c.id = p.cuenta_id
  `
  const grupos = await sql`
    SELECT m.id, m.name AS label, m.user_email, g.name AS context
    FROM grupo_miembros m JOIN grupos g ON g.id = m.grupo_id
  `
  return [
    ...cuentas.map((r) => ({
      id: Number(r.id),
      label: r.label as string,
      userEmail: (r.user_email as string | null) ?? null,
      context: r.context as string,
      kind: 'cuenta' as const,
      payer: r.payer === true,
    })),
    ...grupos.map((r) => ({
      id: Number(r.id),
      label: r.label as string,
      userEmail: (r.user_email as string | null) ?? null,
      context: r.context as string,
      kind: 'grupo' as const,
      payer: false,
    })),
  ]
}

async function applyPeople(users: DirectoryUser[]): Promise<void> {
  const sql = getSql()
  const people = await loadPeople()
  // Foto de antes del primer vínculo, para que el informe no diga "ya tenía
  // email" de alguien que acabamos de vincular.
  await sql`
    INSERT INTO acceso_meta (k, v) VALUES ('people_prior', ${JSON.stringify(people.map((p) => ({
      kind: p.kind, id: p.id, userEmail: p.userEmail,
    })))}::jsonb)
    ON CONFLICT (k) DO NOTHING
  `
  const plan = planLinks(people, users)
  for (const row of plan.link) {
    if (row.kind === 'cuenta') {
      await sql`
        UPDATE participantes SET user_email = ${row.hit.email}
        WHERE id = ${row.id} AND (user_email IS NULL OR user_email = '')
      `
    } else {
      await sql`
        UPDATE grupo_miembros SET user_email = ${row.hit.email}
        WHERE id = ${row.id} AND (user_email IS NULL OR user_email = '')
      `
    }
  }
}

async function applyInvites(hints: JoinHint[], users: DirUserRole[]): Promise<void> {
  const names = new Map(users.map((u) => [u.email.toLowerCase(), u.name]))
  const sql = getSql()
  for (const hint of hints) {
    if (hint.app !== 'cuentas' && hint.app !== 'cuentas-grupo') continue
    if (!hint.token) continue
    const email = hint.email.toLowerCase()
    const table = hint.app === 'cuentas' ? 'cuentas' : 'grupos'
    const rows = table === 'cuentas'
      ? await sql`SELECT id FROM cuentas WHERE token = ${hint.token}`
      : await sql`SELECT id FROM grupos WHERE token = ${hint.token}`
    if (rows.length !== 1) continue
    const id = Number(rows[0].id)
    const name = names.get(email) ?? email
    if (hint.app === 'cuentas') await grantCuentaAccess(id, email, name, 'invitacion')
    else await grantGrupoAccess(id, email, name, 'invitacion')
  }
}

async function snapshot(users: { email: string; name: string; role: string }[]) {
  const sql = getSql()
  const cuentas = await sql`SELECT id, name, owner_email FROM cuentas`
  const grupos = await sql`SELECT id, name, owner_email FROM grupos`
  const pMails = await sql`SELECT cuenta_id, user_email FROM participantes WHERE user_email IS NOT NULL`
  const cAcc = await sql`SELECT cuenta_id, email FROM cuenta_acceso`
  const mMails = await sql`SELECT grupo_id, user_email FROM grupo_miembros WHERE user_email IS NOT NULL`
  const gAcc = await sql`SELECT grupo_id, email FROM grupo_acceso`

  const pack = (
    rows: Record<string, unknown>[],
    idKey: string,
    nameKey: string,
    ownerKey: string,
    mailRows: { id: number; email: string }[],
  ) => {
    const map = new Map<number, { name: string; ownerEmail: string | null; emails: string[] }>()
    for (const r of rows) {
      map.set(Number(r[idKey]), {
        name: r[nameKey] as string,
        ownerEmail: (r[ownerKey] as string | null) ?? null,
        emails: [],
      })
    }
    for (const m of mailRows) {
      const item = map.get(m.id)
      if (item && !item.emails.includes(m.email)) item.emails.push(m.email)
    }
    return [...map.values()]
  }

  const cuentaItems = pack(cuentas, 'id', 'name', 'owner_email', [
    ...pMails.map((r) => ({ id: Number(r.cuenta_id), email: (r.user_email as string).toLowerCase() })),
    ...cAcc.map((r) => ({ id: Number(r.cuenta_id), email: (r.email as string).toLowerCase() })),
  ])
  const grupoItems = pack(grupos, 'id', 'name', 'owner_email', [
    ...mMails.map((r) => ({ id: Number(r.grupo_id), email: (r.user_email as string).toLowerCase() })),
    ...gAcc.map((r) => ({ id: Number(r.grupo_id), email: (r.email as string).toLowerCase() })),
  ])

  const sees = (u: { email: string; role: string }, items: typeof cuentaItems) =>
    items.filter((g) => canSeeResource({
      email: u.email, role: u.role, ownerEmail: g.ownerEmail, memberEmails: g.emails,
    })).map((g) => g.name)

  return users.map((u) => ({
    email: u.email,
    name: u.name,
    role: u.role,
    cuentas: sees(u, cuentaItems),
    grupos: sees(u, grupoItems),
  }))
}

async function saveReport(
  users: { email: string; name: string; role: string }[],
  hints: JoinHint[],
  withRoles: boolean,
): Promise<void> {
  const people = await loadPeople()
  const priorRows = await getSql()`SELECT v FROM acceso_meta WHERE k = 'people_prior'`
  const priorList = (priorRows[0]?.v ?? []) as { kind: string; id: number; userEmail: string | null }[]
  const prior = new Map(priorList.map((p) => [`${p.kind}:${p.id}`, p.userEmail]))
  const plan = planLinks(people.map((p) => ({ ...p, userEmail: null })), users)
  const byId = new Map(people.map((p) => [`${p.kind}:${p.id}`, p]))
  const report = {
    withRoles,
    ranAt: new Date().toISOString(),
    directorio: users.map((u) => ({ name: u.name, email: u.email, role: u.role })),
    vinculados: plan.link.map((p) => {
      const src = byId.get(`${p.kind}:${p.id}`)
      return {
        nombre: p.label,
        donde: `${p.kind === 'cuenta' ? 'Cuenta' : 'Grupo'} ${p.context}`,
        usuario: p.hit.name,
        email: p.hit.email,
        porque: p.hit.reason,
        pagoAlgunGasto: src?.payer === true,
        yaTeniaEmail: !!prior.get(`${p.kind}:${p.id}`),
      }
    }),
    ambiguos: plan.ambiguous.map((p) => ({
      nombre: p.label,
      donde: `${p.kind === 'cuenta' ? 'Cuenta' : 'Grupo'} ${p.context}`,
      candidatos: p.candidates.map((c) => `${c.name} <${c.email}>`),
    })),
    sinMatch: plan.unmatched.map((p) => ({
      nombre: p.label,
      donde: `${p.kind === 'cuenta' ? 'Cuenta' : 'Grupo'} ${p.context}`,
    })),
    invitaciones: hints.filter((h) => h.app === 'cuentas' || h.app === 'cuentas-grupo'),
    quienVe: await snapshot(users),
  }
  await getSql()`
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
