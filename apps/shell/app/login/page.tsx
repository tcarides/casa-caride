import { signIn } from '@/auth'

export const metadata = { title: 'Entrar · Casa Caride' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const { callbackUrl, error } = await searchParams

  return (
    <main className="login">
      <div className="login__card">
        <img className="login__logo" src="/icon-192.png" alt="" aria-hidden width={64} height={64} />
        <h1 className="login__title">Casa Caride</h1>
        <p className="login__subtitle">Las apps de la familia, en un solo lugar</p>

        {error === 'not-allowed' && (
          <p className="login__error">
            Ese email no tiene acceso. Pedile a Tomás una invitación.
          </p>
        )}

        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: callbackUrl || '/' })
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
