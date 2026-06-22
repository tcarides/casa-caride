'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

interface Miembro { id: number; name: string; alias: string | null }
interface Detail { grupo: { id: number; name: string }; miembros: Miembro[] }
const API = '/cuentas-claras/api'

export default function GrupoPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [alias, setAlias] = useState('')
  const [contactos, setContactos] = useState<{ name: string; alias: string }[]>([])
  const nameRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const r = await fetch(`${API}/grupos/${id}`)
    if (r.ok) setD(await r.json())
    setLoading(false)
  }, [id])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    fetch(`${API}/contactos`).then((r) => r.ok ? r.json() : []).then(setContactos).catch(() => {})
  }, [])

  if (loading) return <main className="cc"><p className="cc-empty">Cargando…</p></main>
  if (!d) return <main className="cc"><p className="cc-empty">No se encontró el grupo (o no es tuyo).</p></main>

  function onName(v: string) {
    setName(v)
    const c = contactos.find((c) => c.name.toLowerCase() === v.trim().toLowerCase())
    if (c) setAlias(c.alias)
  }
  async function addMiembro(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await fetch(`${API}/grupos/${id}/miembros`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), alias: alias.trim() }),
    })
    setName(''); setAlias(''); await load(); nameRef.current?.focus()
  }
  async function delMiembro(mid: number) {
    setD((prev) => prev ? { ...prev, miembros: prev.miembros.filter((m) => m.id !== mid) } : prev)
    const r = await fetch(`${API}/miembros/${mid}`, { method: 'DELETE' })
    if (!r.ok) await load()
  }
  async function delGrupo() {
    if (!confirm(`¿Borrar el grupo "${d!.grupo.name}"? (no afecta cuentas ya creadas)`)) return
    const r = await fetch(`${API}/grupos/${id}`, { method: 'DELETE' })
    if (r.ok) window.location.href = '/cuentas-claras/grupos'
  }

  return (
    <main className="cc">
      <header className="cc-header">
        <div className="cc-title">
          <div><h1>{d.grupo.name}</h1><p>{d.miembros.length} contacto{d.miembros.length === 1 ? '' : 's'}</p></div>
        </div>
      </header>

      <section className="cc-card">
        <ul className="cc-list">
          {d.miembros.map((m) => (
            <li key={m.id} className="cc-item">
              <div className="cc-item-main">
                <span className="cc-item-name">{m.name}</span>
                <span className="cc-item-sub">{m.alias ? `alias: ${m.alias}` : 'sin alias'}</span>
              </div>
              <button className="cc-mini" onClick={() => delMiembro(m.id)} aria-label="Quitar">✕</button>
            </li>
          ))}
          {d.miembros.length === 0 && <li className="cc-empty">Sumá contactos al grupo 👇</li>}
        </ul>
        <form className="cc-addrow" onSubmit={addMiembro}>
          <input ref={nameRef} className="cc-input" value={name} onChange={(e) => onName(e.target.value)}
            placeholder="Nombre" maxLength={60} list="cc-contactos" autoComplete="off" />
          <input className="cc-input" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias (opcional)" maxLength={120} />
          <button className="cc-btn" type="submit" disabled={!name.trim()}>+</button>
          <datalist id="cc-contactos">
            {contactos.map((c) => <option key={c.name} value={c.name} />)}
          </datalist>
        </form>
      </section>

      <button className="cc-btn cc-ghost cc-btn-block" onClick={delGrupo}>Borrar grupo</button>
    </main>
  )
}
