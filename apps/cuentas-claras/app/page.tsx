'use client'
import { useCallback, useEffect, useState } from 'react'

interface Cuenta {
  id: number
  name: string
  status: 'abierta' | 'cerrada'
  createdAt: string
}

const API = '/cuentas-claras/api'

export default function Home() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/cuentas`)
      if (r.ok) setCuentas(await r.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setCreating(true)
    try {
      const r = await fetch(`${API}/cuentas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n }),
      })
      if (r.ok) {
        const { id } = await r.json()
        window.location.href = `/cuentas-claras/cuenta/${id}`
      }
    } finally {
      setCreating(false)
    }
  }

  const abiertas = cuentas.filter((c) => c.status === 'abierta')
  const cerradas = cuentas.filter((c) => c.status === 'cerrada')

  return (
    <main className="cc">
      <header className="cc-header">
        <div className="cc-title"><span className="cc-logo" aria-hidden>🧾</span>
          <div><h1>Cuentas Claras</h1><p>Dividí asados y eventos sin vueltas</p></div>
        </div>
      </header>

      <form className="cc-newform" onSubmit={crear}>
        <input className="cc-input" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Nueva cuenta (ej. Asado 21/6)" maxLength={80} />
        <button className="cc-btn" type="submit" disabled={creating || !name.trim()}>Crear</button>
      </form>

      {loading ? (
        <p className="cc-empty">Cargando…</p>
      ) : cuentas.length === 0 ? (
        <p className="cc-empty">Todavía no hay cuentas. Creá la primera 👆</p>
      ) : (
        <>
          {abiertas.length > 0 && <h2 className="cc-sec">Abiertas</h2>}
          {abiertas.map((c) => <CuentaRow key={c.id} c={c} />)}
          {cerradas.length > 0 && <h2 className="cc-sec">Cerradas</h2>}
          {cerradas.map((c) => <CuentaRow key={c.id} c={c} />)}
        </>
      )}
    </main>
  )
}

function CuentaRow({ c }: { c: Cuenta }) {
  return (
    <a className="cc-row" href={`/cuentas-claras/cuenta/${c.id}`}>
      <span className="cc-row-name">{c.name}</span>
      <span className={'cc-badge' + (c.status === 'cerrada' ? ' cerrada' : '')}>
        {c.status === 'cerrada' ? 'cerrada' : 'abierta'}
      </span>
    </a>
  )
}
