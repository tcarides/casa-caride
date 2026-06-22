'use client'
import { useCallback, useEffect, useState } from 'react'

interface Cuenta {
  id: number
  name: string
  status: 'abierta' | 'cerrada'
  ownerEmail: string | null
  createdAt: string
}

const API = '/cuentas-claras/api'

export default function Home() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [me, setMe] = useState<{ email: string; name: string } | null>(null)
  const [meReady, setMeReady] = useState(false)
  const myEmail = me?.email?.toLowerCase() ?? null

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/cuentas`)
      if (r.ok) setCuentas(await r.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    fetch(`${API}/me`).then((r) => r.ok ? r.json() : null).then(setMe).catch(() => {}).finally(() => setMeReady(true))
  }, [])

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
      <header className="cc-header cc-headrow">
        <div className="cc-title"><span className="cc-logo" aria-hidden>🧾</span>
          <div><h1>Cuentas Claras</h1><p>Dividí asados y eventos sin vueltas</p></div>
        </div>
        <div className="cc-headactions">
          {meReady && (
            <span className="cc-me" title={me ? 'Sesión detectada' : 'Sin sesión en la zona'}>
              👤 {me ? me.name : 'no identificado'}
            </span>
          )}
          <a className="cc-chip" href="/cuentas-claras/grupos">👥 Grupos</a>
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
          {abiertas.map((c) => <CuentaRow key={c.id} c={c} myEmail={myEmail} />)}
          {cerradas.length > 0 && <h2 className="cc-sec">Cerradas</h2>}
          {cerradas.map((c) => <CuentaRow key={c.id} c={c} myEmail={myEmail} />)}
        </>
      )}

      <p className="cc-hint">
        Ves las cuentas que creaste y aquellas donde te marcaste como participante.
        ¿Te falta una? Abrí su link y tocá <strong>“soy yo”</strong> en tu nombre.
      </p>
    </main>
  )
}

function CuentaRow({ c, myEmail }: { c: Cuenta; myEmail: string | null }) {
  const compartida = !!c.ownerEmail && !!myEmail && c.ownerEmail.toLowerCase() !== myEmail
  return (
    <a className="cc-row" href={`/cuentas-claras/cuenta/${c.id}`}>
      <span className="cc-row-name">{c.name}</span>
      <span className="cc-row-tags">
        {compartida && <span className="cc-badge compartida">compartida</span>}
        <span className={'cc-badge' + (c.status === 'cerrada' ? ' cerrada' : '')}>
          {c.status === 'cerrada' ? 'cerrada' : 'abierta'}
        </span>
      </span>
    </a>
  )
}
