import { listUsers, getAllAccess } from '@/lib/db'
import { APPS } from '../apps.config'
import { toggleAccess, createUser, removeUser } from './actions'

export const metadata = { title: 'Admin · Casa Caride' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const [users, access] = await Promise.all([listUsers(), getAllAccess()])

  return (
    <main className="admin">
      <header className="admin__head">
        <a href="/" className="admin__back">← Volver</a>
        <h1 className="admin__title">Admin · accesos</h1>
      </header>

      <p className="admin__hint">
        Prendé o apagá cada app por usuario. El admin ve todo. Los cambios se
        aplican al instante.
      </p>

      <div className="admin__tablewrap">
        <table className="admin__table">
          <thead>
            <tr>
              <th className="admin__usercol">Usuario</th>
              {APPS.map((a) => (
                <th key={a.slug} title={a.name}>{a.emoji}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const enabled = new Set(access[u.email] ?? [])
              const isAdmin = u.role === 'admin'
              return (
                <tr key={u.email}>
                  <td className="admin__usercol">
                    <span className="admin__uname">{u.name}</span>
                    <span className="admin__umail">{u.email}{isAdmin ? ' · admin' : ''}</span>
                  </td>
                  {APPS.map((a) => {
                    if (isAdmin) {
                      return <td key={a.slug} className="admin__cell admin__cell--all">✓</td>
                    }
                    const on = enabled.has(a.slug)
                    return (
                      <td key={a.slug} className="admin__cell">
                        <form action={toggleAccess}>
                          <input type="hidden" name="email" value={u.email} />
                          <input type="hidden" name="app" value={a.slug} />
                          <input type="hidden" name="enabled" value={on ? 'false' : 'true'} />
                          <button
                            type="submit"
                            className={'admin__toggle' + (on ? ' on' : '')}
                            aria-label={`${on ? 'Quitar' : 'Dar'} ${a.name} a ${u.name}`}
                          >
                            {on ? '✓' : ''}
                          </button>
                        </form>
                      </td>
                    )
                  })}
                  <td>
                    {!isAdmin && (
                      <form action={removeUser}>
                        <input type="hidden" name="email" value={u.email} />
                        <button type="submit" className="admin__del" aria-label={`Eliminar ${u.name}`}>🗑</button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <section className="admin__add">
        <h2 className="admin__subtitle">Agregar usuario</h2>
        <form action={createUser} className="admin__addform">
          <input className="admin__input" name="name" placeholder="Nombre" required />
          <input className="admin__input" name="email" type="email" placeholder="email@gmail.com" required />
          <select className="admin__input" name="role" defaultValue="member">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="admin__addbtn">Agregar</button>
        </form>
        <p className="admin__hint">
          Para invitar a alguien sin saber su email, usá las invitaciones por WhatsApp (próximamente).
        </p>
      </section>
    </main>
  )
}
