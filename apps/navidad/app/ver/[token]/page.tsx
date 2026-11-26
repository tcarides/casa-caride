import { getGrupoByToken, type Deseo, type Opcion } from '@/lib/db'
import { fmtMoney, linkHost } from '@/lib/format'
import { IconGift, IconExternal } from '../../icons'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Lista de regalos · Casa Caride' }

const PRIO_LABEL: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

function inicial(n: string): string {
  return n.trim().charAt(0).toUpperCase() || '🎁'
}
function opcionElegida(d: Deseo): Opcion | null {
  if (!d.opciones.length) return null
  return d.opciones.find((o) => o.id === d.opcionElegidaId) ?? d.opciones[0]
}

// Vista PÚBLICA de solo lectura de un grupo (link para compartir por WhatsApp).
// No requiere login; no tiene controles de edición.
export default async function VerGrupo({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const grupo = await getGrupoByToken(token)

  if (!grupo) {
    return (
      <main className="nv">
        <div className="nv-empty">Esta lista no existe o el link no es válido.</div>
      </main>
    )
  }

  const personas = grupo.participantes
  return (
    <main className="nv">
      <header className="nv-header">
        <div className="nv-title">
          <span className="nv-logo" aria-hidden><IconGift size={22} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{grupo.nombre}</h1>
            <p>Lista de regalos de Navidad · solo lectura</p>
          </div>
        </div>
      </header>

      {personas.length === 0 && (
        <div className="nv-empty">Todavía no hay nada en esta lista. 🎄</div>
      )}

      {personas.map((p) => (
        <section className="nv-pub-persona" key={p.id}>
          <div className="nv-pub-phead">
            <span className="nv-persona-avatar" aria-hidden>{p.emoji || inicial(p.nombre)}</span>
            <h2 className="nv-pub-pname">{p.nombre}</h2>
          </div>

          {p.deseos.length === 0 && <div className="nv-dg-empty">Sin deseos todavía.</div>}

          <div className="nv-deseos">
            {p.deseos.map((d) => {
              const o = opcionElegida(d)
              return (
                <div className="nv-deseo" key={d.id}>
                  {o?.imagenUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img className="nv-deseo-img" src={o.imagenUrl} alt="" loading="lazy" />
                    : <div className="nv-deseo-img nv-deseo-img--ph" aria-hidden><IconGift size={22} /></div>}
                  <div className="nv-deseo-body">
                    <div className="nv-deseo-top">
                      <div className="nv-deseo-title">{d.titulo}</div>
                      {o?.precio != null && <div className="nv-deseo-price">{fmtMoney(o.precio, o.moneda)}</div>}
                    </div>
                    <div className="nv-deseo-sub">
                      <span className={`nv-prio nv-prio--${d.prioridad}`}>{PRIO_LABEL[d.prioridad]}</span>
                      {o?.link && (
                        <a className="nv-deseo-link" href={o.link} target="_blank" rel="noopener noreferrer">
                          <IconExternal size={13} /> {linkHost(o.link)}
                        </a>
                      )}
                      {d.opciones.length > 1 && (
                        <span className="nv-opc-count">{d.opciones.length} opciones</span>
                      )}
                    </div>
                    {d.nota && <div className="nv-deseo-nota">{d.nota}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div className="nv-pub-cta">
        <a className="nv-btn nv-btn--primary nv-btn--block" href={`https://casa-caride.vercel.app/unirse/${grupo.token}`}>
          Entrar para editar esta lista
        </a>
        <p className="nv-pub-ctahint">Con tu cuenta de Google. Para la familia que arma los regalos.</p>
      </div>

      <footer className="nv-pub-foot">🎄 Casa Caride</footer>
    </main>
  )
}
