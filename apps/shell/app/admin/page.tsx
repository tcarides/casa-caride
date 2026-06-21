import { listUsers, getAllAccess, listPendingInvites } from '@/lib/db'
import { APPS } from '../apps.config'
import { toggleAccess, createUser, removeUser, newInvite, removeInvite } from './actions'

export const metadata = { title: 'Admin · Casa Caride' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const [users, access, invites] = await Promise.all([
    listUsers(), getAllAccess(), listPendingInvites(),
  ])
  const base = process.env.AUTH_URL ?? ''

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
      </section>

      <section className="admin__add">
        <h2 className="admin__subtitle">Invitar por WhatsApp</h2>
        <p className="admin__hint">
          Generá un link. La persona entra con su Google y queda registrada con
          las apps que tildes.
        </p>
        <form action={newInvite} className="admin__inviteform">
          <input className="admin__input" name="note" placeholder="Para quién (ej. Mamá, o 'Amigos')" />
          <div className="admin__appchecks">
            {APPS.map((a) => (
              <label key={a.slug} className="admin__check">
                <input type="checkbox" name="app" value={a.slug} /> {a.emoji} {a.name}
              </label>
            ))}
          </div>
          <label className="admin__check">
            <input type="checkbox" name="multi" /> 🔗 Link para varias personas (lo usan todos hasta que venza)
          </label>
          <button type="submit" className="admin__addbtn">Crear invitación</button>
        </form>

        {invites.length > 0 && (
          <ul className="admin__invites">
            {invites.map((inv) => {
              const url = `${base}/invite/${inv.token}`
              const wa = `https://wa.me/?text=${encodeURIComponent(`Te invito a Casa Caride 🏡 ${url}`)}`
              const appNames = inv.apps
                .map((s) => APPS.find((a) => a.slug === s)?.name ?? s)
                .join(', ') || 'sin apps'
              return (
                <li key={inv.token} className="admin__invite">
                  <div className="admin__invite-main">
                    <span className="admin__uname">
                      {inv.note}
                      {inv.maxUsos === 0
                        ? ` · 🔗 varios (${inv.usos} usaron)`
                        : ` · 1 persona`}
                    </span>
                    <span className="admin__umail">{appNames}</span>
                    <span className="admin__umail">{url}</span>
                  </div>
                  <a className="admin__wa" href={wa} target="_blank" rel="noopener noreferrer">📲 WhatsApp</a>
                  <form action={removeInvite}>
                    <input type="hidden" name="token" value={inv.token} />
                    <button type="submit" className="admin__del" aria-label="Borrar invitación">🗑</button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
