import { APPS } from './apps.config'

export default function Home() {
  return (
    <main className="home">
      <header className="home__header">
        <div className="home__logo" aria-hidden>🏡</div>
        <div>
          <h1 className="home__title">Casa Caride</h1>
          <p className="home__subtitle">Las apps de la familia, en un solo lugar</p>
        </div>
      </header>

      <section className="grid" aria-label="Mini-apps">
        {APPS.map((app) => (
          <a
            key={app.slug}
            href={app.href}
            className="tile"
            style={{ background: app.gradient }}
          >
            <span className="tile__emoji" aria-hidden>{app.emoji}</span>
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
