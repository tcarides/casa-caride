import { cookies } from 'next/headers'

// Gate liviano de la zona: hay sesión si está presente la cookie de login que
// emite el shell (mismo apex). NO decodifica el JWT, así que esta zona no
// necesita AUTH_SECRET. El shell sigue siendo el que pide el login real; acá
// sólo confirmamos que la cookie llegó (igual criterio que el middleware).
const NAMES = ['__Secure-authjs.session-token', 'authjs.session-token']

export async function hasSession(): Promise<boolean> {
  const store = await cookies()
  return (
    NAMES.some((n) => store.has(n)) ||
    // Por si el token viene chunkeado (…session-token.0, .1).
    store.getAll().some((c) => NAMES.some((n) => c.name.startsWith(`${n}.`)))
  )
}
