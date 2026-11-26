import { redirect } from 'next/navigation'
import { createInvite } from '@/lib/db'

export const metadata = { title: 'Unirte · Casa Caride' }
export const dynamic = 'force-dynamic'

// El link de una lista de Navidad también sirve como invitación: validamos el
// token contra la zona navidad (API pública) y, si es válido, creamos una
// invitación real y mandamos al flujo estándar /invite (entrar con Google).
const NAVIDAD = (process.env.NAVIDAD_URL ?? 'https://casa-caride-navidad.vercel.app').replace(/\/$/, '')

export default async function UnirsePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let ok = false
  let nombre: string | null = null
  try {
    const r = await fetch(`${NAVIDAD}/navidad/api/public/token?t=${encodeURIComponent(token)}`, { cache: 'no-store' })
    if (r.ok) {
      const j = (await r.json()) as { ok?: boolean; nombre?: string | null }
      ok = !!j.ok
      nombre = j.nombre ?? null
    }
  } catch { /* red/parseo → inválido */ }

  if (!ok) {
    return (
      <main className="login">
        <div className="login__card">
          <img className="login__logo" src="/icon-192.png" alt="" aria-hidden width={64} height={64} />
          <h1 className="login__title">Link no válido</h1>
          <p className="login__subtitle">Esta lista no existe o el link venció. Pedí uno nuevo a quien te lo compartió.</p>
        </div>
      </main>
    )
  }

  // Invitación de un solo uso (member → apps abiertas, incluida Navidad).
  const inviteToken = await createInvite(`Navidad${nombre ? ': ' + nombre : ''}`, [], 'lista', 1, 14)
  redirect(`/invite/${inviteToken}`)
}
