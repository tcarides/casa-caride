import { redirect } from 'next/navigation'
import { createInvite } from '@/lib/db'
import { auth } from '@/auth'

export const metadata = { title: 'Unirte · Casa Caride' }
export const dynamic = 'force-dynamic'

const CUENTAS = (process.env.CUENTAS_CLARAS_URL ?? 'https://casa-caride-cuentas-claras.vercel.app').replace(/\/$/, '')

export default async function UnirseCuentaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if ((await auth())?.user) redirect(`/cuentas-claras/compartir/cuenta/${token}`)

  let ok = false
  let nombre: string | null = null
  try {
    const r = await fetch(`${CUENTAS}/cuentas-claras/api/public/token?kind=cuenta&t=${encodeURIComponent(token)}`, { cache: 'no-store' })
    if (r.ok) {
      const j = (await r.json()) as { ok?: boolean; nombre?: string | null }
      ok = !!j.ok
      nombre = j.nombre ?? null
    }
  } catch { /* inválido */ }

  if (!ok) {
    return (
      <main className="login">
        <div className="login__card">
          <h1 className="login__title">Link no válido</h1>
          <p className="login__subtitle">Esta cuenta no existe o el link venció. Pedí uno nuevo.</p>
        </div>
      </main>
    )
  }

  const inviteToken = await createInvite(`Cuentas: ${nombre ?? 'cuenta'}`, [], 'lista', 1, 14, `cuentas:${token}`)
  redirect(`/invite/${inviteToken}`)
}