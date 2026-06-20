import { cookies } from 'next/headers'
import { getValidInvite } from '@/lib/db'
import { signIn, INVITE_COOKIE } from '@/auth'
import { APPS } from '../../apps.config'

export const metadata = { title: 'Invitación · Casa Caride' }
export const dynamic = 'force-dynamic'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invite = await getValidInvite(token)

  if (!invite) {
    return (
      <main className="login">
        <div className="login__card">
          <div className="login__logo" aria-hidden>🏡</div>
          <h1 className="login__title">Invitación no válida</h1>
          <p className="login__subtitle">El link venció o ya fue usado. Pedile a Tomás uno nuevo.</p>
        </div>
      </main>
    )
  }

  const appNames = invite.apps
    .map((s) => APPS.find((a) => a.slug === s)?.name ?? s)
    .join(', ')

  return (
    <main className="login">
      <div className="login__card">
        <div className="login__logo" aria-hidden>🏡</div>
        <h1 className="login__title">Te invitaron a Casa Caride</h1>
        <p className="login__subtitle">
          {appNames ? <>Vas a tener acceso a: <strong>{appNames}</strong></> : 'Entrá con tu cuenta de Google'}
        </p>
        <form
          action={async () => {
            'use server'
            ;(await cookies()).set(INVITE_COOKIE, token, {
              httpOnly: true, sameSite: 'lax', maxAge: 900, path: '/',
            })
            await signIn('google', { redirectTo: '/' })
          }}
        >
          <button type="submit" className="login__btn">
            <span aria-hidden>🔓</span> Entrar con Google
          </button>
        </form>
      </div>
    </main>
  )
}
