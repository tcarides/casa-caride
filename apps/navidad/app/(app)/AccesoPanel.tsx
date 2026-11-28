'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'

interface User { email: string; name: string }
interface Persona { id: number; nombre: string; userEmail: string | null }
interface Acceso { email: string; name: string; origen: string }

// El apodo queda a la izquierda. El selector solo dice qué cuenta de Casa
// Caride es esa persona; no reemplaza el nombre que se ve en la lista.
export function AccesoPanel({
  grupoId, ownerName, acceso, participantes, users, onChanged,
}: {
  grupoId: number
  ownerName: string | null
  acceso: Acceso[]
  participantes: Persona[]
  users: User[]
  onChanged: () => void
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const linked = new Set(participantes.map((p) => p.userEmail?.toLowerCase()).filter(Boolean) as string[])
  const extras = acceso.filter((a) => !linked.has(a.email.toLowerCase()))

  async function vincular(id: number, value: string) {
    setBusy(true)
    try {
      await apiFetch(`/api/participantes/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userEmail: value || null }),
      })
      onChanged()
    } finally { setBusy(false) }
  }
  async function sumar() {
    if (!email) return
    setBusy(true)
    try {
      await apiFetch(`/api/grupos/${grupoId}/acceso`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setEmail('')
      onChanged()
    } finally { setBusy(false) }
  }
  async function quitar(who: string) {
    setBusy(true)
    try {
      await apiFetch(`/api/grupos/${grupoId}/acceso?email=${encodeURIComponent(who)}`, { method: 'DELETE' })
      onChanged()
    } finally { setBusy(false) }
  }

  return (
    <section className="nv-acceso">
      <h2>Quién la ve</h2>
      <p className="nv-acceso-note">
        {ownerName ? `La creó ${ownerName}. ` : ''}
        En la lista sigue figurando el apodo. Acá se elige la cuenta, si hace falta.
      </p>
      <ul className="nv-acceso-list">
        {participantes.map((p) => (
          <li key={p.id}>
            <span className="nv-acceso-nick">{p.nombre}</span>
            <select
              className="nv-input nv-acceso-select"
              aria-label={`Vincular a ${p.nombre}`}
              value={p.userEmail ?? ''}
              disabled={busy}
              onChange={(e) => { void vincular(p.id, e.target.value) }}
            >
              <option value="">Sin vincular</option>
              {users.map((u) => <option key={u.email} value={u.email}>{u.name}</option>)}
            </select>
          </li>
        ))}
      </ul>
      {extras.length > 0 && (
        <ul className="nv-acceso-extra">
          {extras.map((a) => (
            <li key={a.email}>
              <span>{a.name}</span>
              <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm" disabled={busy} onClick={() => { void quitar(a.email) }}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="nv-acceso-add">
        <select className="nv-input" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} aria-label="Sumar a alguien">
          <option value="">Sumar alguien de Casa Caride…</option>
          {users.map((u) => <option key={u.email} value={u.email}>{u.name}</option>)}
        </select>
        <button type="button" className="nv-btn nv-btn--primary nv-btn--sm" disabled={busy || !email} onClick={() => { void sumar() }}>
          Sumar
        </button>
      </div>
    </section>
  )
}
