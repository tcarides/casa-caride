'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

interface Miembro { id: number; name: string; alias: string | null; userEmail: string | null }
interface Detail { grupo: { id: number; name: string }; miembros: Miembro[] }
interface RegUser { name: string; email: string; alias: string | null }
interface Contacto { name: string; alias: string | null; email: string | null }
const API = '/cuentas-claras/api'

export default function GrupoPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [regUsers, setRegUsers] = useState<RegUser[]>([])
  const [misContactos, setMisContactos] = useState<Contacto[]>([])
  const [showContactos, setShowContactos] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const nameRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const r = await fetch(`${API}/grupos/${id}`)
    if (r.ok) setD(await r.json())
    setLoading(false)
  }, [id])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    fetch(`${API}/users`).then((r) => r.ok ? r.json() : []).then(setRegUsers).catch(() => {})
    fetch(`${API}/mis-contactos`).then((r) => r.ok ? r.json() : []).then(setMisContactos).catch(() => {})
  }, [])

  if (loading) return <main className="cc"><p className="cc-empty">Cargando…</p></main>
  if (!d) return <main className="cc"><p className="cc-empty">No se encontró el grupo (o no es tuyo).</p></main>

  function resetForm() { setEditId(null); setName(''); setAlias(''); setEmail('') }
  function onName(v: string) {
    setName(v)
    const c = misContactos.find((c) => c.name.toLowerCase() === v.trim().toLowerCase())
    if (c) { if (c.alias) setAlias(c.alias); if (c.email) setEmail(c.email) }
  }
  function pickRegistrado(em: string) {
    const u = regUsers.find((x) => x.email === em)
    if (!u) return
    setName(u.name); setEmail(u.email); if (u.alias) setAlias(u.alias)
  }
  function startEdit(m: Miembro) {
    setEditId(m.id); setName(m.name); setAlias(m.alias ?? ''); setEmail(m.userEmail ?? '')
    nameRef.current?.focus()
  }
  async function submitMiembro(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const body = JSON.stringify({ name: name.trim(), alias: alias.trim(), userEmail: email.trim() || undefined })
    if (editId) {
      await fetch(`${API}/miembros/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body })
    } else {
      await fetch(`${API}/grupos/${id}/miembros`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    }
    resetForm(); await load(); nameRef.current?.focus()
  }
  async function delMiembro(mid: number) {
    if (editId === mid) resetForm()
    setD((prev) => prev ? { ...prev, miembros: prev.miembros.filter((m) => m.id !== mid) } : prev)
    const r = await fetch(`${API}/miembros/${mid}`, { method: 'DELETE' })
    if (!r.ok) await load()
  }
  async function addSeleccionados() {
    const elegidos = contactosDisponibles.filter((c) => checked[c.name])
    if (!elegidos.length) return
    for (const c of elegidos) {
      await fetch(`${API}/grupos/${id}/miembros`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, alias: c.alias ?? '', userEmail: c.email ?? undefined }),
      })
    }
    setChecked({}); setShowContactos(false); await load()
  }
  async function delGrupo() {
    if (!confirm(`¿Borrar el grupo "${d!.grupo.name}"? (no afecta cuentas ya creadas)`)) return
    const r = await fetch(`${API}/grupos/${id}`, { method: 'DELETE' })
    if (r.ok) window.location.href = '/cuentas-claras/grupos'
  }

  // Registrados que todavía no están en el grupo (por email).
  const yaEnGrupo = new Set(d.miembros.map((m) => m.userEmail?.toLowerCase()).filter(Boolean))
  const nombresEnGrupo = new Set(d.miembros.map((m) => m.name.toLowerCase()))
  const regDisponibles = regUsers.filter((u) => !yaEnGrupo.has(u.email.toLowerCase()))
  // Mis contactos de OTROS grupos que aún no están en este.
  const contactosDisponibles = misContactos.filter(
    (c) => !nombresEnGrupo.has(c.name.toLowerCase()) && !(c.email && yaEnGrupo.has(c.email.toLowerCase())),
  )
  const nChecked = contactosDisponibles.filter((c) => checked[c.name]).length

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
                  {m.userEmail && <span className="cc-soyyo on" title={`Vinculado a ${m.userEmail}`}>🔗 {m.userEmail}</span>}
                </span>
                <span className="cc-item-sub">{m.alias ? `alias: ${m.alias}` : 'sin alias'}</span>
              </div>
              <button className="cc-mini" onClick={() => startEdit(m)} aria-label="Editar">✎</button>
              <button className="cc-mini" onClick={() => delMiembro(m.id)} aria-label="Quitar">✕</button>
            </li>
          ))}
          {d.miembros.length === 0 && <li className="cc-empty">Sumá contactos al grupo 👇</li>}
        </ul>

        {!editId && regDisponibles.length > 0 && (
          <div className="cc-addrow">
            <select className="cc-input" value="" onChange={(e) => pickRegistrado(e.target.value)}>
              <option value="">Sumar usuario registrado…</option>
              {regDisponibles.map((u) => <option key={u.email} value={u.email}>{u.name}</option>)}
            </select>
          </div>
        )}

        <form className="cc-gastoform" onSubmit={submitMiembro}>
          {editId && <span className="cc-sec" style={{ margin: 0 }}>Editando contacto</span>}
          <div className="cc-gastoform-row">
            <input ref={nameRef} className="cc-input" value={name} onChange={(e) => onName(e.target.value)}
              placeholder="Nombre" maxLength={60} list="cc-misc" autoComplete="off" />
            <input className="cc-input" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias / CBU (opcional)" maxLength={120} />
          </div>
          <div className="cc-gastoform-row">
            <input className="cc-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              placeholder="Email (opcional, para asociarlo si se registra)" maxLength={200} autoComplete="off" />
            {editId && <button className="cc-btn cc-ghost" type="button" onClick={resetForm}>Cancelar</button>}
            <button className="cc-btn" type="submit" disabled={!name.trim()}>{editId ? 'Guardar' : 'Agregar'}</button>
          </div>
          <datalist id="cc-misc">
            {misContactos.map((c) => <option key={c.name} value={c.name} />)}
          </datalist>
        </form>

        {!editId && contactosDisponibles.length > 0 && (
          <div className="cc-contactos">
            <button className="cc-chip" type="button" onClick={() => setShowContactos((v) => !v)}>
              {showContactos ? '▲ Ocultar contactos' : `👥 Sumar desde mis contactos (${contactosDisponibles.length})`}
            </button>
            {showContactos && (
              <>
                <ul className="cc-checklist">
                  {contactosDisponibles.map((c) => (
                    <li key={c.name}>
                      <label className="cc-check">
                        <input type="checkbox" checked={!!checked[c.name]}
                          onChange={(e) => setChecked((prev) => ({ ...prev, [c.name]: e.target.checked }))} />
                        <span className="cc-check-main">
                          <span className="cc-check-name">{c.name} {c.email && <span className="cc-soyyo on" title={c.email}>🔗</span>}</span>
                          {c.alias && <span className="cc-item-sub">alias: {c.alias}</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button className="cc-btn cc-btn-block" type="button" disabled={nChecked === 0} onClick={addSeleccionados}>
                  Agregar{nChecked > 0 ? ` (${nChecked})` : ''}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <button className="cc-btn cc-ghost cc-btn-block cc-danger" onClick={delGrupo}>Borrar grupo</button>
    </main>
  )
}
