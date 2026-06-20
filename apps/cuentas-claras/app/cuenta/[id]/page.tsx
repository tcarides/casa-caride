'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { upload } from '@vercel/blob/client'

type EstadoCarga = 'pendiente' | 'listo' | 'sin_gastos'
interface Participante { id: number; name: string; alias: string | null; estado: EstadoCarga }
interface Gasto { id: number; descripcion: string; monto: number; pagadorId: number; comprobanteUrl: string | null }
interface Liquidacion { id: number; fromId: number; toId: number; monto: number; pagado: boolean }
interface Cuenta { id: number; name: string; status: 'abierta' | 'cerrada' }
interface Detail { cuenta: Cuenta; participantes: Participante[]; gastos: Gasto[]; liquidaciones: Liquidacion[] }

const API = '/cuentas-claras/api'
const money = (c: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(c / 100)
const toCentavos = (s: string) => Math.round((parseFloat(s.replace(',', '.')) || 0) * 100)

export default function CuentaPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)

  // forms
  const [pName, setPName] = useState('')
  const [pAlias, setPAlias] = useState('')
  const [gDesc, setGDesc] = useState('')
  const [gMonto, setGMonto] = useState('')
  const [gPagador, setGPagador] = useState('')
  const [gFile, setGFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const r = await fetch(`${API}/cuentas/${id}`)
    if (r.ok) setD(await r.json())
    setLoading(false)
  }, [id])
  useEffect(() => { void load() }, [load])

  if (loading) return <main className="cc"><p className="cc-empty">Cargando…</p></main>
  if (!d) return <main className="cc"><p className="cc-empty">No se encontró la cuenta.</p></main>

  const { cuenta, participantes, gastos, liquidaciones } = d
  const abierta = cuenta.status === 'abierta'
  const total = gastos.reduce((s, g) => s + g.monto, 0)
  const porCabeza = participantes.length ? total / participantes.length : 0
  const nameOf = (pid: number) => participantes.find((p) => p.id === pid)?.name ?? '?'
  const aliasOf = (pid: number) => participantes.find((p) => p.id === pid)?.alias ?? null

  async function addParticipante(e: React.FormEvent) {
    e.preventDefault()
    if (!pName.trim()) return
    await fetch(`${API}/cuentas/${id}/participantes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pName.trim(), alias: pAlias.trim() }),
    })
    setPName(''); setPAlias(''); await load()
  }
  async function delParticipante(pid: number) {
    await fetch(`${API}/participantes/${pid}`, { method: 'DELETE' }); await load()
  }
  async function editAlias(p: Participante) {
    const alias = prompt(`Alias / CBU de ${p.name} (para transferirle):`, p.alias ?? '')
    if (alias == null) return
    await fetch(`${API}/participantes/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: p.name, alias }),
    })
    await load()
  }
  async function addGasto(e: React.FormEvent) {
    e.preventDefault()
    const monto = toCentavos(gMonto)
    if (!gDesc.trim() || monto <= 0 || !gPagador) return
    setUploading(true)
    try {
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
      setGDesc(''); setGMonto(''); setGFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } finally {
      setUploading(false)
    }
  }
  async function delGasto(gid: number) {
    await fetch(`${API}/gastos/${gid}`, { method: 'DELETE' }); await load()
  }
  async function setEstado(pid: number, estado: EstadoCarga) {
    await fetch(`${API}/participantes/${pid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    await load()
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
  async function togglePagado(l: Liquidacion) {
    await fetch(`${API}/liquidaciones/${l.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagado: !l.pagado }),
    })
    await load()
  }

  return (
    <main className="cc">
      <header className="cc-header">
        <a className="cc-back" href="/cuentas-claras">← Cuentas</a>
        <div className="cc-title">
          <div><h1>{cuenta.name}</h1>
            <p>{abierta ? 'Abierta' : 'Cerrada'} · {money(total)} en {gastos.length} gasto{gastos.length === 1 ? '' : 's'}</p>
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
                  <span className="cc-item-name">{p.name} <EstadoBadge estado={p.estado} /></span>
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
                <button className="cc-mini" onClick={() => editAlias(p)} aria-label="Editar alias">✎</button>
                {abierta && <button className="cc-mini" onClick={() => delParticipante(p.id)} aria-label="Quitar">✕</button>}
              </li>
            )
          })}
        </ul>
        {abierta && (
          <form className="cc-addrow" onSubmit={addParticipante}>
            <input className="cc-input" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Nombre" maxLength={60} />
            <input className="cc-input" value={pAlias} onChange={(e) => setPAlias(e.target.value)} placeholder="Alias (opcional)" maxLength={120} />
            <button className="cc-btn" type="submit" disabled={!pName.trim()}>+</button>
          </form>
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
              {abierta && <button className="cc-mini" onClick={() => delGasto(g.id)} aria-label="Borrar">✕</button>}
            </li>
          ))}
          {gastos.length === 0 && <li className="cc-empty">Sin gastos todavía.</li>}
        </ul>
        {abierta && participantes.length > 0 && (
          <form className="cc-addrow cc-gastoform" onSubmit={addGasto}>
            <input className="cc-input" value={gDesc} onChange={(e) => setGDesc(e.target.value)} placeholder="Qué (ej. carne)" maxLength={120} />
            <input className="cc-input cc-montoinput" value={gMonto} onChange={(e) => setGMonto(e.target.value)} placeholder="$" inputMode="decimal" />
            <select className="cc-input" value={gPagador} onChange={(e) => setGPagador(e.target.value)}>
              <option value="">¿Quién pagó?</option>
              {participantes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className={'cc-mini cc-attach' + (gFile ? ' cc-on' : '')} title="Adjuntar comprobante">
              📎
              <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden
                onChange={(e) => setGFile(e.target.files?.[0] ?? null)} />
            </label>
            <button className="cc-btn" type="submit" disabled={uploading || !gDesc.trim() || toCentavos(gMonto) <= 0 || !gPagador}>
              {uploading ? '…' : '+'}
            </button>
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
    </main>
  )
}

function EstadoBadge({ estado }: { estado: EstadoCarga }) {
  if (estado === 'listo') return <span className="cc-estbadge listo">cargó</span>
  if (estado === 'sin_gastos') return <span className="cc-estbadge sin">no gastó</span>
  return <span className="cc-estbadge pend">pendiente</span>
}
