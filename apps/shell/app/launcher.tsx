import type { CSSProperties } from 'react'
import { ADMIN_LINKS, APPS, accessOf, type MiniApp } from './apps.config'
import { InstallInfo } from './InstallInfo'
import { getViewer } from '@/lib/view-as'
import { getEnabledApps } from '@/lib/db'

type TileMode = 'open' | 'login' | 'locked'

function tileMode(
  app: MiniApp,
  loggedIn: boolean,
  isAdmin: boolean,
  enabled: Set<string> | null,
): TileMode | 'hidden' {
  const access = accessOf(app)
  if (access === 'public') return 'open'
  if (access === 'open') return loggedIn ? 'open' : 'login'
  if (!loggedIn) return 'hidden'
  if (isAdmin || enabled!.has(app.slug)) return 'open'
  return 'locked'
}

export async function Launcher({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; 'solo-lectura'?: string }>
}) {
  const { effective, viewing } = await getViewer()
  const params = await searchParams
  const denied = params.denied
  const soloLectura = params['solo-lectura']

  // Identidad efectiva: con "ver como" es la de esa persona (rol, email, nombre).
  const loggedIn = !!effective
  const isAdmin = effective?.role === 'admin'
  const email = effective?.email ?? ''
  const name = effective?.name ?? ''

  // El admin no necesita filas. Un member: las 'open' se abren igual (aunque
  // no haya fila) y las de permiso sólo si están habilitadas.
  const enabled = loggedIn && !isAdmin ? new Set(await getEnabledApps(email)) : null

  const tiles = APPS.flatMap((app) => {
    const mode = tileMode(app, loggedIn, isAdmin, enabled)
    return mode === 'hidden' ? [] : [{ app, mode }]
  })
  const unlocked = tiles.filter((t) => t.mode !== 'locked')
  const locked = tiles.filter((t) => t.mode === 'locked')
  const deniedApp = denied ? APPS.find((a) => a.slug === denied) : null

  return (
    <main className="home">
      <header className="home__header">
        <img className="home__logo" src="/icon-192.png" alt="" aria-hidden width={54} height={54} />
        <div className="home__heading">
          <h1 className="home__title">Casa Caride</h1>
          <p className="home__subtitle">Apps para la vida de todos los días</p>
        </div>
        <InstallInfo />
      </header>

      <div className="home__userbar">
        <span className="home__who">{loggedIn ? `${name || email}${isAdmin ? ' · admin' : ''}` : 'No estás logueado'}</span>
        <span className="home__useractions">
          {loggedIn ? (
            <>
              {isAdmin && <a href="/admin" className="home__userlink">Admin</a>}
              <form action="/api/session/logout" method="post">
                <button type="submit" className="home__userlink home__signout">{viewing ? 'Cerrar sesión' : 'Salir'}</button>
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

      {soloLectura && (
        <p className="home__denied">
          {viewing
            ? <>Estás viendo como <strong>{viewing.name}</strong>. No podés crear, editar ni borrar nada.</>
            : 'No podés modificar nada en esta vista.'}
        </p>
      )}

      <section className="grid" aria-label="Mini-apps">
        {unlocked.map(({ app, mode }) => (
          <AppTile key={app.slug} app={app} mode={mode} />
        ))}
        {isAdmin &&
          ADMIN_LINKS.map((link) => (
            <a
              key={link.slug}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="tile"
              style={{ '--tile-hue': link.hue } as CSSProperties}
            >
              <span className="tile__glow" aria-hidden />
              <span className="tile__emoji" aria-hidden>{link.emoji}</span>
              <span className="tile__tag">↗ aparte</span>
              <span className="tile__name">{link.name}</span>
              <span className="tile__desc">{link.description}</span>
            </a>
          ))}
      </section>

      {locked.length > 0 && (
        <>
          <h2 className="home__section">
            <svg className="home__section-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Bloqueadas
          </h2>
          <section className="grid" aria-label="Apps bloqueadas">
            {locked.map(({ app }) => (
              <AppTile key={app.slug} app={app} mode="locked" />
            ))}
          </section>
        </>
      )}

      <footer className="home__footer">
        <span>Instalá esta app en tu pantalla de inicio 📲</span>
      </footer>
    </main>
  )
}

function AppTile({ app, mode }: { app: MiniApp; mode: TileMode }) {
  const locked = mode === 'locked'
  const className = [
    'tile',
    app.icon ? 'tile--art' : '',
    locked ? 'tile--locked' : '',
  ].filter(Boolean).join(' ')
  const style = { '--tile-hue': app.hue, '--art-bg': app.iconBg } as CSSProperties
  const inner = (
    <>
      {app.icon ? (
        <img className="tile__art" src={app.icon} alt="" aria-hidden />
      ) : (
        <>
          <span className="tile__glow" aria-hidden />
          <span className="tile__emoji" aria-hidden>{app.emoji}</span>
        </>
      )}
      {locked && <LockBadge />}
      {mode === 'login' && <span className="tile__tag">🔒 login</span>}
      {mode === 'open' && app.kind === 'static' && <span className="tile__tag">estática</span>}
      <span className="tile__meta">
        <span className="tile__name">{app.name}</span>
        <span className="tile__desc">{app.description}</span>
      </span>
    </>
  )

  if (locked) {
    return (
      <div className={className} style={style} aria-disabled="true">
        {inner}
      </div>
    )
  }

  return (
    <a href={app.href} className={className} style={style}>
      {inner}
    </a>
  )
}

function LockBadge() {
  return (
    <span className="tile__lock" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  )
}
