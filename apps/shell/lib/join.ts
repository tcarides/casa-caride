const KINDS = new Set(['navidad', 'cuentas', 'cuentas-grupo'])

export function isJoinRef(value: string | null | undefined): value is string {
  if (!value) return false
  const i = value.indexOf(':')
  if (i < 1) return false
  const kind = value.slice(0, i)
  const token = value.slice(i + 1)
  return KINDS.has(kind) && /^[a-z0-9]+$/i.test(token)
}

/** A dónde mandar a la persona después de aceptar la invitación. */
export function joinPath(ref: string | null | undefined): string {
  if (!isJoinRef(ref)) return '/'
  const i = ref.indexOf(':')
  const kind = ref.slice(0, i)
  const token = ref.slice(i + 1)
  if (kind === 'navidad') return `/navidad/ver/${token}`
  if (kind === 'cuentas-grupo') return `/cuentas-claras/compartir/grupo/${token}`
  return `/cuentas-claras/compartir/cuenta/${token}`
}
