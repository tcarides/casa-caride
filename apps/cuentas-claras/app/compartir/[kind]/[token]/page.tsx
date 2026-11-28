import { redirect } from 'next/navigation'
import { findByToken, grantCuentaAccess, grantGrupoAccess, cuentaGate, grupoGate } from '@/lib/access'
import { currentUser, isViewingAs } from '@/lib/identity'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sumarte · Cuentas Claras' }

// Abrir el link suma a quien está logueado. Sin sesión, ofrece entrar con Google.
// "Ver como" no escribe: si esa persona no está, no la agrega.
export default async function CompartirPage({ params }: { params: Promise<{ kind: string; token: string }> }) {
  const { kind, token } = await params
  const which = kind === 'cuenta' ? 'cuenta' : kind === 'grupo' ? 'grupo' : null
  const found = which ? await findByToken(which, token) : null

  if (!which || !found) {
    return (
      <main className="cc">
        <p className="cc-empty">Este link no es válido. Pedile uno nuevo a quien te lo pasó.</p>
      </main>
    )
  }

  const user = await currentUser()
  const viewing = user ? await isViewingAs() : false
  if (user && !viewing) {
    if (which === 'cuenta') await grantCuentaAccess(found.id, user.email, user.name, 'link')
    else await grantGrupoAccess(found.id, user.email, user.name, 'link')
    redirect(which === 'cuenta' ? `/cuenta/${found.id}` : `/grupos/${found.id}`)
  }

  if (user && viewing) {
    const gate = which === 'cuenta' ? await cuentaGate(found.id, user) : await grupoGate(found.id, user)
    if (gate === 'read' || gate === 'manage') {
      redirect(which === 'cuenta' ? `/cuenta/${found.id}` : `/grupos/${found.id}`)
    }
    return (
      <main className="cc">
        <p className="cc-empty">
          Estás viendo como {user.name}. Esta vista no la suma a {which === 'cuenta' ? 'la cuenta' : 'el grupo'} «{found.name}».
        </p>
      </main>
    )
  }

  const join = which === 'cuenta' ? `/unirse/cuenta/${token}` : `/unirse/grupo/${token}`
  return (
    <main className="cc">
      <header className="cc-header">
        <div className="cc-title">
          <div>
            <h1>{found.name}</h1>
            <p>{which === 'cuenta' ? 'Una cuenta de Cuentas Claras' : 'Un grupo de Cuentas Claras'}</p>
          </div>
        </div>
      </header>
      <p className="cc-empty">Entrá con Google para verla y que te quede en tu lista.</p>
      <a className="cc-btn cc-btn-block" href={join}>Entrar con Google</a>
    </main>
  )
}
