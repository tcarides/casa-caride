'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { upload } from '@vercel/blob/client'

type EstadoCarga = 'pendiente' | 'listo' | 'sin_gastos'
interface Participante { id: number; name: string; alias: string | null; estado: EstadoCarga; userEmail: string | null }
interface Gasto { id: number; descripcion: string; monto: number; pagadorId: number; comprobanteUrl: string | null }
interface Liquidacion { id: number; fromId: number; toId: number; monto: number; pagado: boolean }
interface Cuenta { id: number; name: string; status: 'abierta' | 'cerrada'; fecha: string | null }
interface Detail { cuenta: Cuenta; participantes: Participante[]; gastos: Gasto[]; liquidaciones: Liquidacion[] }
interface Contacto { name: string; alias: string | null; email: string | null }

const API = '/cuentas-claras/api'
const money = (c: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(c / 100)
// "1.234,56" (formato AR: punto = miles, coma = decimales) → centavos.
const fromMonto = (s: string) => s.replace(/\./g, '').replace(',', '.')
const toCentavos = (s: string) => Math.round((parseFloat(fromMonto(s)) || 0) * 100)
// Formatea lo que se va tipeando: separa miles con punto, deja una coma decimal.
function formatMonto(raw: string): string {
  const s = raw.replace(/[^\d,]/g, '')
  const i = s.indexOf(',')
  let intPart = i >= 0 ? s.slice(0, i) : s
  const dec = i >= 0 ? ',' + s.slice(i + 1).replace(/,/g, '').slice(0, 2) : ''
  intPart = intPart.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  if (intPart === '' && i >= 0) intPart = '0'
  return intPart + dec
}
// 'YYYY-MM-DD' → "viernes 27 de junio" (sin la coma que mete es-AR).
function fmtFecha(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
    .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '')
}

export default function CuentaPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<{ email: string; name: string } | null>(null)

  // forms
  const [pName, setPName] = useState('')
  const [pAlias, setPAlias] = useState('')
  const [gDesc, setGDesc] = useState('')
  const [gMonto, setGMonto] = useState('')
  const [gPagador, setGPagador] = useState('')
  const [gFile, setGFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [grupos, setGrupos] = useState<{ id: number; name: string; miembros: number }[]>([])
  const [grupoFiltro, setGrupoFiltro] = useState('')
  const [grupoMiembros, setGrupoMiembros] = useState<Contacto[]>([])
  const [misContactos, setMisContactos] = useState<Contacto[]>([])
  const [showContactos, setShowContactos] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [editFecha, setEditFecha] = useState(false)
  const descRef = useRef<HTMLInputElement>(null)
  const pNameRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const r = await fetch(`${API}/cuentas/${id}`)
    if (r.ok) setD(await r.json())
    setLoading(false)
  }, [id])
  useEffect(() => { void load() }, [load])

  // Mis contactos (gente de mis grupos), mis grupos y mi identidad.
  useEffect(() => {
    fetch(`${API}/grupos`).then((r) => r.ok ? r.json() : []).then(setGrupos).catch(() => {})
    fetch(`${API}/mis-contactos`).then((r) => r.ok ? r.json() : []).then(setMisContactos).catch(() => {})
    fetch(`${API}/me`).then((r) => r.ok ? r.json() : null).then(setMe).catch(() => {})
  }, [])

  // Filtro de grupo para la lista de "mis contactos": al elegir un grupo,
  // la lista se acota a sus miembros; "Todos" muestra todos mis contactos.
  useEffect(() => {
    setChecked({})
    if (!grupoFiltro) { setGrupoMiembros([]); return }
    fetch(`${API}/grupos/${grupoFiltro}`)
      .then((r) => r.ok ? r.json() : null)
      .then((g: { miembros?: { name: string; alias: string | null; userEmail: string | null }[] } | null) => {
        setGrupoMiembros((g?.miembros ?? []).map((m) => ({ name: m.name, alias: m.alias, email: m.userEmail })))
      })
      .catch(() => {})
  }, [grupoFiltro])

  // Default del pagador: el primer participante (evita un click por gasto).
  useEffect(() => {
    if (d && !gPagador && d.participantes.length) setGPagador(String(d.participantes[0].id))
  }, [d, gPagador])

  if (loading) return <main className="cc"><p className="cc-empty">Cargando…</p></main>
  if (!d) return <main className="cc"><p className="cc-empty">No se encontró la cuenta.</p></main>

  const { cuenta, participantes, gastos, liquidaciones } = d
  const abierta = cuenta.status === 'abierta'
  const total = gastos.reduce((s, g) => s + g.monto, 0)
  const porCabeza = participantes.length ? total / participantes.length : 0
  const nameOf = (pid: number) => participantes.find((p) => p.id === pid)?.name ?? '?'
  const aliasOf = (pid: number) => participantes.find((p) => p.id === pid)?.alias ?? null
  const myEmail = me?.email?.toLowerCase() ?? null
  const isMe = (p: Participante) => !!myEmail && p.userEmail?.toLowerCase() === myEmail
  const yaParticipa = new Set(participantes.map((p) => p.name.toLowerCase()))
  const baseContactos = grupoFiltro ? grupoMiembros : misContactos
  const contactosDisponibles = baseContactos.filter((c) => !yaParticipa.has(c.name.toLowerCase()))
  const nChecked = contactosDisponibles.filter((c) => checked[c.name]).length
  const todosMarcados = contactosDisponibles.length > 0 && nChecked === contactosDisponibles.length

  async function addParticipante(e: React.FormEvent) {
    e.preventDefault()
    if (!pName.trim()) return
    await fetch(`${API}/cuentas/${id}/participantes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pName.trim(), alias: pAlias.trim() }),
    })
    setPName(''); setPAlias(''); await load()
    pNameRef.current?.focus() // seguir agregando sin volver a tocar el campo
  }
  function onPName(v: string) {
    setPName(v)
    const c = misContactos.find((c) => c.name.toLowerCase() === v.trim().toLowerCase())
    if (c?.alias) setPAlias(c.alias) // autocompleta el alias de un contacto conocido
  }
  function toggleTodos() {
    if (todosMarcados) { setChecked({}); return }
    const all: Record<string, boolean> = {}
    for (const c of contactosDisponibles) all[c.name] = true
    setChecked(all)
  }
  async function guardarFecha(value: string) {
    const fecha = value || null
    setD((prev) => prev ? { ...prev, cuenta: { ...prev.cuenta, fecha } } : prev)
    setEditFecha(false)
    await fetch(`${API}/cuentas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha }),
    })
  }
  async function addSeleccionados() {
    const elegidos = contactosDisponibles.filter((c) => checked[c.name])
    if (!elegidos.length) return
    for (const c of elegidos) {
      await fetch(`${API}/cuentas/${id}/participantes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, alias: c.alias ?? '', userEmail: c.email ?? undefined }),
      })
    }
    setChecked({}); setShowContactos(false); await load()
  }
  async function delParticipante(pid: number) {
    setD((prev) => prev ? { ...prev, participantes: prev.participantes.filter((p) => p.id !== pid) } : prev)
    const r = await fetch(`${API}/participantes/${pid}`, { method: 'DELETE' })
    if (!r.ok) await load()
  }
  async function editAlias(p: Participante) {
    // Si está vinculado a un usuario, el alias se gestiona desde el grupo (item 6).
    if (p.userEmail) {
      alert(`El alias de ${p.name} está vinculado a su usuario y se edita desde Grupos, no acá.`)
      return
    }
    const alias = prompt(`Alias / CBU de ${p.name} (para transferirle):`, p.alias ?? '')
    if (alias == null) return
    setD((prev) => prev ? { ...prev, participantes: prev.participantes.map((x) => x.id === p.id ? { ...x, alias: alias.trim() || null } : x) } : prev)
    const r = await fetch(`${API}/participantes/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: p.name, alias }),
    })
    if (!r.ok) await load()
  }
  async function toggleSoyYo(p: Participante) {
    if (!myEmail) return
    const claim = p.userEmail?.toLowerCase() !== myEmail
    // Optimista: me asigno a este y libero cualquier otro que tuviera mi email.
    setD((prev) => prev ? { ...prev, participantes: prev.participantes.map((x) => {
      if (x.id === p.id) return { ...x, userEmail: claim ? (me?.email ?? null) : null }
      if (claim && x.userEmail?.toLowerCase() === myEmail) return { ...x, userEmail: null }
      return x
    }) } : prev)
    const r = await fetch(`${API}/participantes/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim }),
    })
    if (!r.ok) await load()
  }
  function startEdit(g: Gasto) {
    setEditId(g.id)
    setGDesc(g.descripcion)
    setGMonto(formatMonto(String(g.monto / 100).replace('.', ',')))
    setGPagador(String(g.pagadorId))
    descRef.current?.focus()
  }
  function cancelEdit() {
    setEditId(null); setGDesc(''); setGMonto(''); setGFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }
  async function addGasto(e: React.FormEvent) {
    e.preventDefault()
    const monto = toCentavos(gMonto)
    if (!gDesc.trim() || monto <= 0 || !gPagador) return
    setUploading(true)
    try {
      if (editId) {
        // Editar gasto existente (no se cambia el comprobante acá).
        await fetch(`${API}/gastos/${editId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descripcion: gDesc.trim(), monto, pagadorId: Number(gPagador) }),
        })
        setEditId(null)
      } else {
        let comprobanteUrl: string | null = null
        let comprobantePath: string | null = null
        if (gFile) {
          const blob = await upload(gFile.name, gFile, {
            access: 'private', // se sirve autenticado por /cuentas-claras/api/file
            handleUploadUrl: '/cuentas-claras/api/upload',
            multipart: true,
          })
          comprobanteUrl = blob.url
          comprobantePath = blob.pathname
        }
        await fetch(`${API}/cuentas/${id}/gastos`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descripcion: gDesc.trim(), monto, pagadorId: Number(gPagador),
            comprobanteUrl, comprobantePath,
          }),
        })
      }
      setGDesc(''); setGMonto(''); setGFile(null) // se mantiene el pagador elegido
      if (fileRef.current) fileRef.current.value = ''
      await load()
      descRef.current?.focus() // listo para cargar el próximo gasto
    } finally {
      setUploading(false)
    }
  }
  async function delGasto(gid: number) {
    setD((prev) => prev ? { ...prev, gastos: prev.gastos.filter((g) => g.id !== gid) } : prev)
    const r = await fetch(`${API}/gastos/${gid}`, { method: 'DELETE' })
    if (!r.ok) await load()
  }
  async function setEstado(pid: number, estado: EstadoCarga) {
    setD((prev) => prev ? { ...prev, participantes: prev.participantes.map((p) => p.id === pid ? { ...p, estado } : p) } : prev)
    const r = await fetch(`${API}/participantes/${pid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    if (!r.ok) await load()
  }
  async function cerrar() {
    if (!confirm('¿Cerrar la cuenta y calcular quién le debe a quién?')) return
    const r = await fetch(`${API}/cuentas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cerrar' }),
    })
    if (r.status === 409) {
      const data = await r.json().catch(() => ({})) as { pendientes?: string[] }
      alert(`Todavía falta que confirmen: ${(data.pendientes ?? []).join(', ')}.\nMarcalos como "Cargó" o "No gastó", o recordáles que carguen sus gastos.`)
      return
    }
    await load()
  }
  async function reabrir() {
    await fetch(`${API}/cuentas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reabrir' }),
    })
    await load()
  }
  async function borrarCuenta() {
    if (!confirm(`¿Borrar la cuenta "${cuenta.name}"? Se eliminan sus gastos y participantes. No se puede deshacer.`)) return
    const r = await fetch(`${API}/cuentas/${id}`, { method: 'DELETE' })
    if (r.ok) window.location.href = '/cuentas-claras'
  }
  async function togglePagado(l: Liquidacion) {
    setD((prev) => prev ? { ...prev, liquidaciones: prev.liquidaciones.map((x) => x.id === l.id ? { ...x, pagado: !x.pagado } : x) } : prev)
    const r = await fetch(`${API}/liquidaciones/${l.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagado: !l.pagado }),
    })
    if (!r.ok) await load()
  }

  return (
    <main className="cc">
      <header className="cc-header">
        <div className="cc-title">
          <div><h1>{cuenta.name}</h1>
            <p>{abierta ? 'Abierta' : 'Cerrada'} · {money(total)} en {gastos.length} gasto{gastos.length === 1 ? '' : 's'}</p>
            <div className="cc-fecha">
              {editFecha ? (
                <input className="cc-input cc-fecha-input" type="date" autoFocus
                  defaultValue={cuenta.fecha ?? ''}
                  onChange={(e) => guardarFecha(e.target.value)}
                  onBlur={() => setEditFecha(false)} />
              ) : cuenta.fecha ? (
                <button className="cc-fecha-btn" onClick={() => setEditFecha(true)} title="Cambiar fecha">
                  📅 {fmtFecha(cuenta.fecha)}
                </button>
              ) : (
                <button className="cc-fecha-btn cc-fecha-add" onClick={() => setEditFecha(true)}>
                  📅 Agregar fecha
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Participantes */}
      <section className="cc-card">
        <h2 className="cc-sec">Participantes ({participantes.length})</h2>
        <ul className="cc-list">
          {participantes.map((p) => {
            const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
            const waCargar = `https://wa.me/?text=${encodeURIComponent(`Hola ${p.name}, antes de cerrar "${cuenta.name}" cargá tus gastos (o avisá que no gastaste): ${pageUrl}`)}`
            return (
              <li key={p.id} className="cc-item">
                <div className="cc-item-main">
                  <span className="cc-item-name">
                    {p.name} <EstadoBadge estado={p.estado} />
                    {me && (
                      <button
                        className={'cc-soyyo' + (isMe(p) ? ' on' : '')}
                        onClick={() => toggleSoyYo(p)}
                        title={isMe(p) ? 'Sos vos (tocá para soltar)' : 'Marcar que este sos vos para ver la cuenta en tu lista'}
                      >
                        {isMe(p) ? '★ vos' : 'soy yo'}
                      </button>
                    )}
                  </span>
                  <span className="cc-item-sub">{p.alias ? `alias: ${p.alias}` : 'sin alias'}</span>
                  {abierta && (
                    <div className="cc-estado">
                      <button className={'cc-chip' + (p.estado === 'listo' ? ' on' : '')} onClick={() => setEstado(p.id, p.estado === 'listo' ? 'pendiente' : 'listo')}>Cargó ✓</button>
                      <button className={'cc-chip' + (p.estado === 'sin_gastos' ? ' on' : '')} onClick={() => setEstado(p.id, p.estado === 'sin_gastos' ? 'pendiente' : 'sin_gastos')}>No gastó</button>
                      {p.estado === 'pendiente' && (
                        <a className="cc-chip cc-wa" href={waCargar} target="_blank" rel="noopener noreferrer">📲 recordar</a>
                      )}
                    </div>
                  )}
                </div>
                <button className="cc-mini" onClick={() => editAlias(p)}
                  aria-label="Editar alias"
                  title={p.userEmail ? 'Alias gestionado desde el grupo' : 'Editar alias'}>
                  {p.userEmail ? '🔒' : '✎'}
                </button>
                {abierta && <button className="cc-mini" onClick={() => delParticipante(p.id)} aria-label="Quitar">✕</button>}
              </li>
            )
          })}
        </ul>
        {abierta && (
          <form className="cc-addrow" onSubmit={addParticipante}>
            <input ref={pNameRef} className="cc-input" value={pName} onChange={(e) => onPName(e.target.value)}
              placeholder="Nombre" maxLength={60} list="cc-contactos" autoComplete="off" />
            <input className="cc-input" value={pAlias} onChange={(e) => setPAlias(e.target.value)} placeholder="Alias (opcional)" maxLength={120} />
            <button className="cc-btn" type="submit" disabled={!pName.trim()}>+</button>
            <datalist id="cc-contactos">
              {misContactos.map((c) => <option key={c.name} value={c.name} />)}
            </datalist>
          </form>
        )}
        {abierta && (misContactos.length > 0 || grupos.length > 0) && (
          <div className="cc-contactos">
            <button className="cc-chip" type="button" onClick={() => setShowContactos((v) => !v)}>
              {showContactos ? '▲ Ocultar contactos' : '👥 Sumar desde mis contactos'}
            </button>
            {showContactos && (
              <>
                {grupos.length > 0 && (
                  <select className="cc-input cc-grupofiltro" value={grupoFiltro} onChange={(e) => setGrupoFiltro(e.target.value)}>
                    <option value="">Todos mis contactos</option>
                    {grupos.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.miembros})</option>)}
                  </select>
                )}
                {contactosDisponibles.length === 0 ? (
                  <p className="cc-empty">No hay contactos para sumar acá.</p>
                ) : (
                  <>
                    <div className="cc-checkhead">
                      <button className="cc-soyyo" type="button" onClick={toggleTodos}>
                        {todosMarcados ? 'Ninguno' : 'Todos'}
                      </button>
                    </div>
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
              </>
            )}
          </div>
        )}
      </section>

      {/* Gastos */}
      <section className="cc-card">
        <h2 className="cc-sec">Gastos · {money(total)}{participantes.length > 0 && <span className="cc-perhead"> · {money(porCabeza)} por cabeza</span>}</h2>
        <ul className="cc-list">
          {gastos.map((g) => (
            <li key={g.id} className="cc-item">
              <div className="cc-item-main">
                <span className="cc-item-name">{g.descripcion}</span>
                <span className="cc-item-sub">pagó {nameOf(g.pagadorId)}</span>
              </div>
              <span className="cc-monto">{money(g.monto)}</span>
              {g.comprobanteUrl && (
                <a className="cc-mini" href={`/cuentas-claras/api/file?gasto=${g.id}`} target="_blank" rel="noopener noreferrer" aria-label="Ver comprobante">📎</a>
              )}
              {abierta && <button className="cc-mini" onClick={() => startEdit(g)} aria-label="Editar">✎</button>}
              {abierta && <button className="cc-mini" onClick={() => delGasto(g.id)} aria-label="Borrar">✕</button>}
            </li>
          ))}
          {gastos.length === 0 && (
            <li className="cc-empty">
              {participantes.length === 0 ? 'Primero agregá participantes 👆' : 'Sin gastos todavía.'}
            </li>
          )}
        </ul>
        {abierta && participantes.length > 0 && (
          <form className="cc-gastoform" onSubmit={addGasto}>
            {editId && <span className="cc-sec" style={{ margin: 0 }}>Editando gasto</span>}
            <input ref={descRef} className="cc-input" value={gDesc} onChange={(e) => setGDesc(e.target.value)}
              placeholder="¿Qué se pagó? (ej. carne)" maxLength={120} />
            <div className="cc-gastoform-row">
              <div className="cc-montowrap">
                <span className="cc-montosign">$</span>
                <input className="cc-input cc-montoinput" value={gMonto}
                  onChange={(e) => setGMonto(formatMonto(e.target.value))} placeholder="0" inputMode="decimal" />
              </div>
              <select className="cc-input" value={gPagador} onChange={(e) => setGPagador(e.target.value)}>
                <option value="">¿Quién pagó?</option>
                {participantes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="cc-gastoform-row">
              {!editId && (
                <label className={'cc-attachlabel' + (gFile ? ' cc-on' : '')}>
                  📎 <span className="cc-attachtext">{gFile ? gFile.name : 'Adjuntar comprobante'}</span>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden
                    onChange={(e) => setGFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
              {editId && (
                <button className="cc-btn cc-ghost" type="button" onClick={cancelEdit}>Cancelar</button>
              )}
              <button className="cc-btn" type="submit" disabled={uploading || !gDesc.trim() || toCentavos(gMonto) <= 0 || !gPagador}>
                {uploading ? 'Guardando…' : editId ? 'Guardar' : 'Agregar gasto'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Cerrar / Liquidación */}
      {abierta ? (
        <>
          {(() => {
            const pendientes = participantes.filter((p) => p.estado === 'pendiente')
            return pendientes.length > 0 ? (
              <p className="cc-aviso">
                Antes de cerrar, falta confirmar a: <strong>{pendientes.map((p) => p.name).join(', ')}</strong>.
                Marcalos como <em>Cargó</em> / <em>No gastó</em>, o tocá 📲 para que carguen su gasto.
              </p>
            ) : null
          })()}
          <button className="cc-btn cc-btn-block" onClick={cerrar}
            disabled={participantes.length < 2 || gastos.length === 0 || participantes.some((p) => p.estado === 'pendiente')}>
            Cerrar y calcular deudas
          </button>
        </>
      ) : (
        <section className="cc-card">
          <h2 className="cc-sec">Quién le debe a quién</h2>
          {liquidaciones.length === 0 ? (
            <p className="cc-empty">¡Está todo parejo! Nadie debe nada 🎉</p>
          ) : (
            <ul className="cc-list">
              {liquidaciones.map((l) => {
                const fromN = nameOf(l.fromId), toN = nameOf(l.toId), alias = aliasOf(l.toId)
                const msg = `Hola ${fromN}, te recuerdo que del "${cuenta.name}" quedó pendiente transferirle ${money(l.monto)} a ${toN}${alias ? ` (alias: ${alias})` : ''}. ¡Gracias! 🙌`
                const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`
                return (
                  <li key={l.id} className={'cc-deuda' + (l.pagado ? ' pagada' : '')}>
                    <div className="cc-item-main">
                      <span className="cc-item-name">{fromN} → {toN}</span>
                      <span className="cc-item-sub">{alias ? `alias: ${alias}` : 'sin alias'}</span>
                    </div>
                    <span className="cc-monto">{money(l.monto)}</span>
                    {alias && <button className="cc-mini" onClick={() => navigator.clipboard?.writeText(alias)} aria-label="Copiar alias">📋</button>}
                    <a className="cc-mini cc-wa" href={wa} target="_blank" rel="noopener noreferrer" aria-label="Recordar por WhatsApp">📲</a>
                    <button className={'cc-mini' + (l.pagado ? ' cc-on' : '')} onClick={() => togglePagado(l)} aria-label="Marcar saldada">✓</button>
                  </li>
                )
              })}
            </ul>
          )}
          <button className="cc-btn cc-ghost cc-btn-block" onClick={reabrir}>Reabrir cuenta</button>
        </section>
      )}

      <button className="cc-btn cc-ghost cc-btn-block cc-danger" onClick={borrarCuenta}>
        Borrar cuenta
      </button>
    </main>
  )
}

function EstadoBadge({ estado }: { estado: EstadoCarga }) {
  if (estado === 'listo') return <span className="cc-estbadge listo">cargó</span>
  if (estado === 'sin_gastos') return <span className="cc-estbadge sin">no gastó</span>
  return <span className="cc-estbadge pend">pendiente</span>
}
