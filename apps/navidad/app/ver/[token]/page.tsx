import { getGrupoByToken } from '@/lib/db'
import { IconGift } from '../../icons'
import PublicList from './PublicList'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Lista de regalos · Casa Caride' }

// Vista PÚBLICA de solo lectura de un grupo (link para compartir por WhatsApp).
// No requiere login; no tiene controles de edición. El buscador y el render de
// la lista viven en PublicList (client), que filtra del lado del cliente.
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

      <PublicList participantes={grupo.participantes} />

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
