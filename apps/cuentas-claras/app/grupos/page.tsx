'use client'
import { useCallback, useEffect, useState } from 'react'

interface Grupo { id: number; name: string; miembros: number }
interface Contacto { name: string; alias: string | null; email: string | null; grupos: string[] }
interface RegUser { name: string; email: string }
const API = '/cuentas-claras/api'
const ckey = (c: Contacto) => (c.email?.toLowerCase() || c.name.toLowerCase())

export default function Contactos() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [regEmails, setRegEmails] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [invitando, setInvitando] = useState<string | null>(null)
  const [links, setLinks] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const [g, c, u] = await Promise.all([
        fetch(`${API}/grupos`).then((r) => r.ok ? r.json() : []),
        fetch(`${API}/contactos`).then((r) => r.ok ? r.json() : []),
        fetch(`${API}/users`).then((r) => r.ok ? r.json() : []),
      ])
      setGrupos(g); setContactos(c)
      setRegEmails(new Set((u as RegUser[]).map((x) => x.email.toLowerCase())))
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    const r = await fetch(`${API}/grupos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n }),
    })
    if (r.ok) { const { id } = await r.json(); window.location.href = `/cuentas-claras/grupos/${id}` }
  }

  // Invita a un contacto: deja el vínculo contacto↔email en Cuentas Claras y
  // pide al shell un link de invitación. Al entrar con ese email, la persona
  // queda identificada con su contacto. Sólo accede a apps abiertas.
  async function invitar(c: Contacto) {
    const key = ckey(c)
    let mail = (c.email ?? '').trim().toLowerCase()
    if (!mail) {
      mail = (prompt(`¿A qué email le mando la invitación a ${c.name}?\n(tiene que entrar con ese mismo mail de Google)`) ?? '').trim().toLowerCase()
      if (!mail || !mail.includes('@')) return
    }
    setInvitando(key)
    try {
      await fetch(`${API}/contactos/invitar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, email: mail }),
      })
      const r = await fetch('/api/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: c.name }),
      })
      if (!r.ok) { alert('No se pudo crear la invitación. Probá de nuevo.'); return }
      const { url } = await r.json()
      setLinks((prev) => ({ ...prev, [key]: url }))
      const msg = `¡Hola ${c.name}! Te sumo a Casa Caride 🏡 para llevar las cuentas juntos. Entrá con este link e ingresá con tu Google ${mail}: ${url}`
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
      void load()
    } finally { setInvitando(null) }
  }

  return (
    <main className="cc">
      <header className="cc-header">
        <div className="cc-title"><span className="cc-logo" aria-hidden>👥</span>
          <div><h1>Contactos</h1><p>Tu gente y los grupos donde la organizás</p></div>
        </div>
      </header>

      <form className="cc-newform" onSubmit={crear}>
        <input className="cc-input" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Nuevo grupo (ej. Amigos, Familia)" maxLength={60} />
        <button className="cc-btn" type="submit" disabled={!name.trim()}>Crear</button>
      </form>

      {loading ? (
        <p className="cc-empty">Cargando…</p>
      ) : (
        <>
          <h2 className="cc-sec">Grupos</h2>
          {grupos.length === 0 ? (
            <p className="cc-empty">Todavía no tenés grupos. Creá uno 👆</p>
          ) : grupos.map((g) => (
            <a key={g.id} className="cc-row" href={`/cuentas-claras/grupos/${g.id}`}>
              <span className="cc-row-name">{g.name}</span>
              <span className="cc-badge cerrada">{g.miembros} {g.miembros === 1 ? 'contacto' : 'contactos'}</span>
            </a>
          ))}

          <h2 className="cc-sec">Todos los contactos</h2>
          {contactos.length === 0 ? (
            <p className="cc-empty">Sin contactos todavía. Sumá gente a tus grupos.</p>
          ) : contactos.map((c) => {
            const key = ckey(c)
            const open = abierto === key
            const registrado = !!c.email && regEmails.has(c.email.toLowerCase())
            const link = links[key]
            return (
              <div key={key} className="cc-contacto">
                <button className={'cc-row cc-contacto-row' + (open ? ' cc-open' : '')} type="button"
                  onClick={() => setAbierto(open ? null : key)} aria-expanded={open}>
                  <span className="cc-row-info">
                    <span className="cc-row-name">
                      {c.name} {registrado && <span className="cc-soyyo on" title="Tiene cuenta en Casa Caride">✓</span>}
                    </span>
                    {c.alias && <span className="cc-row-fecha">alias: {c.alias}</span>}
                  </span>
                  <span className="cc-row-tags">
                    <span className="cc-badge cerrada">{c.grupos.length} {c.grupos.length === 1 ? 'grupo' : 'grupos'}</span>
                    <span className="cc-caret">{open ? '▲' : '▼'}</span>
                  </span>
                </button>
                {open && (
                  <div className="cc-contacto-grupos">
                    {c.email && <p className="cc-item-sub">{c.email}</p>}
                    <div className="cc-chips">
                      {c.grupos.map((g) => <span key={g} className="cc-chip">{g}</span>)}
                    </div>
                    {registrado ? (
                      <p className="cc-item-sub cc-reg">✓ Ya está en Casa Caride</p>
                    ) : link ? (
                      <div className="cc-invite-done">
                        <p className="cc-item-sub">Invitación lista. Reenviá el link si hace falta:</p>
                        <div className="cc-addrow">
                          <input className="cc-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                          <button className="cc-btn cc-ghost" type="button"
                            onClick={() => { navigator.clipboard?.writeText(link); }}>Copiar</button>
                        </div>
                      </div>
                    ) : (
                      <button className="cc-btn cc-btn-block" type="button"
                        disabled={invitando === key} onClick={() => invitar(c)}>
                        {invitando === key ? 'Generando…' : '✉️ Invitar a Casa Caride'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </main>
  )
}
