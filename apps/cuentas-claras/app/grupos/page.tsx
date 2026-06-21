'use client'
import { useCallback, useEffect, useState } from 'react'

interface Grupo { id: number; name: string; miembros: number }
const API = '/cuentas-claras/api'

export default function Grupos() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/grupos`)
      if (r.ok) setGrupos(await r.json())
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
        <a className="cc-back" href="/cuentas-claras">← Cuentas</a>
        <div className="cc-title"><span className="cc-logo" aria-hidden>👥</span>
          <div><h1>Grupos de contactos</h1><p>Precargá a tu gente para sumarla de una</p></div>
        </div>
      </header>

      <form className="cc-newform" onSubmit={crear}>
        <input className="cc-input" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Nuevo grupo (ej. Amigos, Familia)" maxLength={60} />
        <button className="cc-btn" type="submit" disabled={!name.trim()}>Crear</button>
      </form>

      {loading ? (
        <p className="cc-empty">Cargando…</p>
      ) : grupos.length === 0 ? (
        <p className="cc-empty">Todavía no tenés grupos. Creá uno 👆</p>
      ) : grupos.map((g) => (
        <a key={g.id} className="cc-row" href={`/cuentas-claras/grupos/${g.id}`}>
          <span className="cc-row-name">{g.name}</span>
          <span className="cc-badge cerrada">{g.miembros} {g.miembros === 1 ? 'contacto' : 'contactos'}</span>
        </a>
      ))}
    </main>
  )
}
