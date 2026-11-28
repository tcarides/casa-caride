// Quién ve una lista o un grupo. Misma regla en Navidad y en Cuentas Claras:
// el admin ve todo; el resto, si es quien lo creó o si está como miembro
// (acceso explícito o persona vinculada a su email).

export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin'
}

function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

export function canSeeResource(opts: {
  email: string
  role: string
  ownerEmail: string | null
  memberEmails: readonly string[]
}): boolean {
  if (isAdminRole(opts.role)) return true
  if (sameEmail(opts.ownerEmail, opts.email)) return true
  return opts.memberEmails.some((m) => sameEmail(m, opts.email))
}

export function canManageResource(opts: {
  email: string
  role: string
  ownerEmail: string | null
}): boolean {
  if (isAdminRole(opts.role)) return true
  return sameEmail(opts.ownerEmail, opts.email)
}
