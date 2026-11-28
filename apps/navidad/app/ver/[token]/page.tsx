import { getGrupoByToken } from '@/lib/db'
import { grantGrupoAccess } from '@/lib/access'
import { currentUser, isViewingAs } from '@/lib/identity'
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

  // Abrir el link con la sesión iniciada suma a la persona. "Ver como" es
  // solo lectura: mirar la lista no mete a Clara (ni a nadie) como miembro.
  let joined = false
  const user = await currentUser()
  if (user && !(await isViewingAs())) {
    await grantGrupoAccess(grupo.id, user.email, user.name, 'link')
    joined = true
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

      <div className="nv-pub-banner">
        <div className="nv-pub-banner-body">
          <p className="nv-pub-banner-title">
            {joined ? 'Listo, esta lista quedó entre las tuyas' : '👀 Estás mirando esta lista (solo lectura)'}
          </p>
          <p className="nv-pub-banner-sub">
            {joined
              ? 'La vas a ver en Regalos de Navidad cuando entres con tu cuenta.'
              : '¿Sos de la familia que arma los regalos? Entrá con tu cuenta de Google para agregar y editar deseos.'}
          </p>
        </div>
        <a
          className="nv-btn nv-btn--primary nv-btn--block"
          href={joined ? `/navidad?g=${grupo.id}` : `https://casa-caride.vercel.app/unirse/${grupo.token}`}
        >
          {joined ? 'Abrir en mis listas' : 'Entrar con Google para editar'}
        </a>
      </div>

      <PublicList participantes={grupo.participantes} />

      <footer className="nv-pub-foot">🎄 Casa Caride</footer>
    </main>
  )
}
