// Vincula un apodo o un nombre libre con un usuario de Casa Caride.
// Solo hay match automático cuando la coincidencia es única. Un diminutivo
// ("Clari", "Mamama") no se adivina: entra por la lista de alias que el dueño
// confirmó, y solo si esa persona está en el directorio y es la única.

export interface DirectoryUser {
  email: string
  name: string
}

export type LinkReason = 'nombre-completo' | 'primer-nombre' | 'nombre-parcial' | 'alias'

export interface LinkHit {
  email: string
  name: string
  reason: LinkReason
}

export type LinkDecision =
  | { status: 'linked'; hit: LinkHit }
  | { status: 'ambiguous'; candidates: { email: string; name: string }[] }
  | { status: 'unmatched' }

export interface PersonRow {
  id: number
  label: string
  userEmail: string | null
}

interface NormUser extends DirectoryUser {
  key: string
  tokens: string[]
}

const CLARA_EMAIL = 'clara.caride@holycross.edu.ar'

// Alias que el dueño nombró. No incluyen otros diminutivos (Flori, Tomi):
// esos solo matchean si el nombre del usuario es exactamente ese.
const ALIASES: { keys: string[]; test: (u: NormUser) => boolean }[] = [
  {
    keys: ['clari'],
    test: (u) => u.key === 'clara caride' || u.email === CLARA_EMAIL,
  },
  {
    keys: ['mamama'],
    test: (u) => u.key === 'maria silvia siritto' || u.tokens.includes('siritto'),
  },
]

export function normName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hit(u: NormUser, reason: LinkReason): LinkDecision {
  return { status: 'linked', hit: { email: u.email, name: u.name, reason } }
}

function ambiguous(list: NormUser[]): LinkDecision {
  return {
    status: 'ambiguous',
    candidates: list.map((u) => ({ email: u.email, name: u.name })),
  }
}

export function decideLink(label: string, users: readonly DirectoryUser[]): LinkDecision {
  const key = normName(label)
  if (key.length < 2) return { status: 'unmatched' }

  const people: NormUser[] = []
  const seen = new Set<string>()
  for (const raw of users) {
    const email = raw.email.trim().toLowerCase()
    const name = raw.name.trim()
    const nameKey = normName(name)
    if (!email.includes('@') || !nameKey || seen.has(email)) continue
    seen.add(email)
    people.push({ email, name, key: nameKey, tokens: nameKey.split(' ').filter(Boolean) })
  }

  const full = people.filter((u) => u.key === key)
  if (full.length === 1) return hit(full[0], 'nombre-completo')
  if (full.length > 1) return ambiguous(full)

  const first = people.filter((u) => u.tokens[0] === key)
  if (first.length === 1) return hit(first[0], 'primer-nombre')
  if (first.length > 1) return ambiguous(first)

  const tokens = key.split(' ').filter(Boolean)
  if (tokens.length >= 2) {
    const partial = people.filter((u) => tokens.every((t, i) => u.tokens[i] === t))
    if (partial.length === 1) return hit(partial[0], 'nombre-parcial')
    if (partial.length > 1) return ambiguous(partial)
  }

  const alias = ALIASES.find((a) => a.keys.includes(key))
  if (alias) {
    const found = people.filter(alias.test)
    if (found.length === 1) return hit(found[0], 'alias')
    if (found.length > 1) return ambiguous(found)
  }

  return { status: 'unmatched' }
}

export function planLinks<T extends PersonRow>(people: readonly T[], users: readonly DirectoryUser[]): {
  link: (T & { hit: LinkHit })[]
  already: T[]
  ambiguous: (T & { candidates: { email: string; name: string }[] })[]
  unmatched: T[]
} {
  const link: (T & { hit: LinkHit })[] = []
  const already: T[] = []
  const ambiguousRows: (T & { candidates: { email: string; name: string }[] })[] = []
  const unmatched: T[] = []
  for (const person of people) {
    if (person.userEmail) {
      already.push(person)
      continue
    }
    const decision = decideLink(person.label, users)
    if (decision.status === 'linked') link.push({ ...person, hit: decision.hit })
    else if (decision.status === 'ambiguous') ambiguousRows.push({ ...person, candidates: decision.candidates })
    else unmatched.push(person)
  }
  return { link, already, ambiguous: ambiguousRows, unmatched }
}
