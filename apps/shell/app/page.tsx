import type { CSSProperties } from 'react'
import { APPS } from './apps.config'
import { InstallInfo } from './InstallInfo'
import { auth, signOut } from '@/auth'
import { getEnabledApps } from '@/lib/db'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const session = await auth()
  const { denied } = await searchParams

  const loggedIn = !!session?.user
  const isAdmin = session?.user?.role === 'admin'
  const email = session?.user?.email ?? ''
  const name = session?.user?.name ?? ''

  const enabled = loggedIn && !isAdmin ? new Set(await getEnabledApps(email)) : null

  // Qué apps mostrar:
  //  - deslogueado: públicas + 'open' (se ven, pero al usarlas piden login).
  //  - admin: todas.
  //  - member: públicas + 'open' + las habilitadas.
  const apps = APPS.filter((a) => {
    const access = a.access ?? 'permission'
    if (access === 'public' || access === 'open') return true
    if (!loggedIn) return false
    return isAdmin || enabled!.has(a.slug)
  })
  const deniedApp = denied ? APPS.find((a) => a.slug === denied) : null

  return (
    <main className="home">
      <header className="home__header">
        <div className="home__logo" aria-hidden>🏡</div>
        <div className="home__heading">
          <h1 className="home__title">Casa Caride</h1>
          <p className="home__subtitle">Las apps de la familia, en un solo lugar</p>
        </div>
        <InstallInfo />
      </header>

      <div className="home__userbar">
        <span className="home__who">{loggedIn ? `${name || email}${isAdmin ? ' · admin' : ''}` : 'No estás logueado'}</span>
        <span className="home__useractions">
          {loggedIn ? (
            <>
              {isAdmin && <a href="/admin" className="home__userlink">Admin</a>}
              <form
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/' })
                }}
              >
                <button type="submit" className="home__userlink home__signout">Salir</button>
              </form>
            </>
          ) : (
            <a href="/login" className="home__userlink">Entrar</a>
          )}
        </span>
      </div>

      {deniedApp && (
        <p className="home__denied">
          No tenés acceso a <strong>{deniedApp.name}</strong>. Pedile a Tomás que te lo habilite.
        </p>
      )}

      <section className="grid" aria-label="Mini-apps">
        {apps.map((app) => {
          const access = app.access ?? 'permission'
          const needsLogin = !loggedIn && access !== 'public'
          return (
            <a
              key={app.slug}
              href={app.href}
              className="tile"
              style={{ '--tile-hue': app.hue } as CSSProperties}
            >
              <span className="tile__glow" aria-hidden />
              <span className="tile__emoji" aria-hidden>{app.emoji}</span>
              {needsLogin && <span className="tile__tag">🔒 login</span>}
              {!needsLogin && app.kind === 'static' && <span className="tile__tag">estática</span>}
              <span className="tile__name">{app.name}</span>
              <span className="tile__desc">{app.description}</span>
            </a>
          )
        })}
      </section>

      <footer className="home__footer">
        <span>Instalá esta app en tu pantalla de inicio 📲</span>
      </footer>
    </main>
  )
}
