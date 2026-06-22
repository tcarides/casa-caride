'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

interface Miembro { id: number; name: string; alias: string | null; userEmail: string | null }
interface Detail { grupo: { id: number; name: string }; miembros: Miembro[] }
interface RegUser { name: string; email: string; alias: string | null }
const API = '/cuentas-claras/api'

export default function GrupoPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [alias, setAlias] = useState('')
  const [linkedEmail, setLinkedEmail] = useState('')
  const [contactos, setContactos] = useState<{ name: string; alias: string }[]>([])
  const [regUsers, setRegUsers] = useState<RegUser[]>([])
  const nameRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const r = await fetch(`${API}/grupos/${id}`)
    if (r.ok) setD(await r.json())
    setLoading(false)
  }, [id])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    fetch(`${API}/contactos`).then((r) => r.ok ? r.json() : []).then(setContactos).catch(() => {})
    fetch(`${API}/users`).then((r) => r.ok ? r.json() : []).then(setRegUsers).catch(() => {})
  }, [])

  if (loading) return <main className="cc"><p className="cc-empty">Cargando…</p></main>
  if (!d) return <main className="cc"><p className="cc-empty">No se encontró el grupo (o no es tuyo).</p></main>

  function onName(v: string) {
    setName(v)
    setLinkedEmail('') // si edita el nombre a mano, deja de estar vinculado
    const c = contactos.find((c) => c.name.toLowerCase() === v.trim().toLowerCase())
    if (c) setAlias(c.alias)
  }
  function pickRegistrado(email: string) {
    const u = regUsers.find((x) => x.email === email)
    if (!u) return
    setName(u.name)
    setLinkedEmail(u.email)
    if (u.alias) setAlias(u.alias) // reusa el alias guardado del usuario
  }
  async function addMiembro(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await fetch(`${API}/grupos/${id}/miembros`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), alias: alias.trim(), userEmail: linkedEmail || undefined }),
    })
    setName(''); setAlias(''); setLinkedEmail(''); await load(); nameRef.current?.focus()
  }
  // Registrados que todavía no están en el grupo (por email).
  const yaEnGrupo = new Set((d?.miembros ?? []).map((m) => m.userEmail?.toLowerCase()).filter(Boolean))
  const regDisponibles = regUsers.filter((u) => !yaEnGrupo.has(u.email.toLowerCase()))
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
                <span className="cc-item-name">
                  {m.name}
                  {m.userEmail && <span className="cc-soyyo on" title={`Vinculado a ${m.userEmail}`}>🔗 registrado</span>}
                </span>
                <span className="cc-item-sub">{m.alias ? `alias: ${m.alias}` : 'sin alias'}</span>
              </div>
              <button className="cc-mini" onClick={() => delMiembro(m.id)} aria-label="Quitar">✕</button>
            </li>
          ))}
          {d.miembros.length === 0 && <li className="cc-empty">Sumá contactos al grupo 👇</li>}
        </ul>
        {regDisponibles.length > 0 && (
          <div className="cc-addrow">
            <select className="cc-input" value={linkedEmail} onChange={(e) => pickRegistrado(e.target.value)}>
              <option value="">Sumar usuario registrado…</option>
              {regDisponibles.map((u) => <option key={u.email} value={u.email}>{u.name}</option>)}
            </select>
          </div>
        )}
        <form className="cc-addrow" onSubmit={addMiembro}>
          <input ref={nameRef} className="cc-input" value={name} onChange={(e) => onName(e.target.value)}
            placeholder="Nombre" maxLength={60} list="cc-contactos" autoComplete="off" />
          <input className="cc-input" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias (opcional)" maxLength={120} />
          <button className="cc-btn" type="submit" disabled={!name.trim()}>+</button>
          <datalist id="cc-contactos">
            {contactos.map((c) => <option key={c.name} value={c.name} />)}
          </datalist>
        </form>
        {linkedEmail && (
          <p className="cc-hint" style={{ textAlign: 'left', padding: '4px 2px 0' }}>
            Se vinculará a <strong>{linkedEmail}</strong> · la cuenta donde lo importes le aparecerá automáticamente.
            <button className="cc-soyyo" style={{ marginLeft: 8 }} onClick={() => { setLinkedEmail(''); setName('') }}>quitar</button>
          </p>
        )}
      </section>

      <button className="cc-btn cc-ghost cc-btn-block" onClick={delGrupo}>Borrar grupo</button>
    </main>
  )
}
