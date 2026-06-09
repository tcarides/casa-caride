import type { CSSProperties } from 'react'
import { APPS } from './apps.config'
import { InstallInfo } from './InstallInfo'

export default function Home() {
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

      <section className="grid" aria-label="Mini-apps">
        {APPS.map((app) => (
          <a
            key={app.slug}
            href={app.href}
            className="tile"
            style={{ '--tile-hue': app.hue } as CSSProperties}
          >
            <span className="tile__glow" aria-hidden />
            <span className="tile__emoji" aria-hidden>{app.emoji}</span>
            {app.kind === 'static' && <span className="tile__tag">estática</span>}
            <span className="tile__name">{app.name}</span>
            <span className="tile__desc">{app.description}</span>
          </a>
        ))}
      </section>

      <footer className="home__footer">
        <span>Instalá esta app en tu pantalla de inicio 📲</span>
      </footer>
    </main>
  )
}
