'use client'
import { useCallback, useEffect, useState } from 'react'

interface Grupo { id: number; name: string; miembros: number }
interface Contacto { name: string; alias: string | null; email: string | null; grupos: string[] }
const API = '/cuentas-claras/api'

export default function Contactos() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [g, c] = await Promise.all([
        fetch(`${API}/grupos`).then((r) => r.ok ? r.json() : []),
        fetch(`${API}/contactos`).then((r) => r.ok ? r.json() : []),
      ])
      setGrupos(g); setContactos(c)
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
            const key = c.email?.toLowerCase() || c.name.toLowerCase()
            const open = abierto === key
            return (
              <div key={key} className="cc-contacto">
                <button className={'cc-row cc-contacto-row' + (open ? ' cc-open' : '')} type="button"
                  onClick={() => setAbierto(open ? null : key)} aria-expanded={open}>
                  <span className="cc-row-info">
                    <span className="cc-row-name">
                      {c.name} {c.email && <span className="cc-soyyo on" title={c.email}>🔗</span>}
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
