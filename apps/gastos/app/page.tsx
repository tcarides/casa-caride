'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { CATEGORIAS, COMPARTIDO } from '@/lib/constants'
import {
  fmtMoney, parseMoney, fmtPeriodo, shiftPeriodo, periodoHoy, fechaHoy, fmtDiaCorto,
} from '@/lib/format'

interface Persona { id: number; nombre: string; orden: number }
interface Movimiento {
  id: number; periodo: string; fijoId: number | null; nombre: string; categoria: string
  pagador: string; monto: number; vencimiento: string | null; pagado: boolean
  fechaPago: string | null; tipo: 'fijo' | 'variable'; omitido: boolean; createdAt: string
}
interface State { periodo: string; personas: Persona[]; movimientos: Movimiento[] }

type Draft = {
  id?: number
  nombre: string
  monto: string
  categoria: string
  pagador: string
  pagado: boolean
  fecha: string
}

const HOY = periodoHoy()

export default function GastosPage() {
  const [periodo, setPeriodo] = useState(HOY)
  const [state, setState] = useState<State | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/state?periodo=${p}`)
      if (res.ok) setState(await res.json() as State)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(periodo) }, [periodo, load])

  const movs = useMemo(() => (state?.movimientos ?? []).filter(m => !m.omitido), [state])
  const omitidos = useMemo(() => (state?.movimientos ?? []).filter(m => m.omitido), [state])
  const pagadores = useMemo(
    () => [...(state?.personas ?? []).map(p => p.nombre), COMPARTIDO],
    [state],
  )

  const hoy = fechaHoy()
  const esVencido = (m: Movimiento) => !m.pagado && !!m.vencimiento && m.vencimiento < hoy

  // Totales
  const total = movs.reduce((s, m) => s + m.monto, 0)
  const pendientes = movs.filter(m => !m.pagado)
  const totalPend = pendientes.reduce((s, m) => s + m.monto, 0)
  const pagados = movs.filter(m => m.pagado)

  const porPersona = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of movs) map.set(m.pagador, (map.get(m.pagador) ?? 0) + m.monto)
    return pagadores.map(n => ({ nombre: n, total: map.get(n) ?? 0 })).filter(x => x.total > 0)
  }, [movs, pagadores])

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of movs) map.set(m.categoria, (map.get(m.categoria) ?? 0) + m.monto)
    return [...map.entries()].map(([nombre, val]) => ({ nombre, val })).sort((a, b) => b.val - a.val)
  }, [movs])
  const maxCat = porCategoria[0]?.val ?? 1

  // ── Mutaciones ──
  async function togglePagado(m: Movimiento) {
    if (busy) return
    const nuevo = !m.pagado
    // Optimista
    setState(s => s && ({ ...s, movimientos: s.movimientos.map(x =>
      x.id === m.id ? { ...x, pagado: nuevo, fechaPago: nuevo ? hoy : null } : x) }))
    await apiFetch(`/api/movimientos/${m.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagado: nuevo, fechaPago: nuevo ? hoy : null }),
    })
    void load(periodo)
  }

  async function saveDraft() {
    if (!draft || !draft.nombre.trim() || busy) return
    setBusy(true)
    const payload = {
      nombre: draft.nombre.trim(),
      categoria: draft.categoria,
      pagador: draft.pagador,
      monto: parseMoney(draft.monto),
      pagado: draft.pagado,
      fechaPago: draft.pagado ? (draft.fecha || hoy) : null,
      vencimiento: draft.pagado ? null : (draft.fecha || null),
    }
    try {
      if (draft.id) {
        await apiFetch(`/api/movimientos/${draft.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch('/api/movimientos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ periodo, ...payload }),
        })
      }
      setDraft(null)
      await load(periodo)
    } finally {
      setBusy(false)
    }
  }

  async function borrar(m: Movimiento) {
    if (busy) return
    const msg = m.tipo === 'fijo'
      ? `¿Omitir "${m.nombre}" en este mes? (la plantilla sigue activa)`
      : `¿Borrar "${m.nombre}"?`
    if (!confirm(msg)) return
    setBusy(true)
    try {
      await apiFetch(`/api/movimientos/${m.id}`, { method: 'DELETE' })
      await load(periodo)
    } finally {
      setBusy(false)
    }
  }

  async function restaurar(m: Movimiento) {
    await apiFetch(`/api/movimientos/${m.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore: true }),
    })
    await load(periodo)
  }

  function nuevoVariable() {
    setDraft({
      nombre: '', monto: '', categoria: 'Supermercado',
      pagador: pagadores[0] ?? COMPARTIDO, pagado: true, fecha: hoy,
    })
  }

  function editar(m: Movimiento) {
    setDraft({
      id: m.id, nombre: m.nombre, monto: m.monto ? String(m.monto / 100) : '',
      categoria: m.categoria, pagador: m.pagador, pagado: m.pagado,
      fecha: (m.pagado ? m.fechaPago : m.vencimiento) ?? hoy,
    })
  }

  return (
    <div className="g">
      <header className="g-header">
        <div className="g-title">
          <span className="g-logo">💸</span>
          <div>
            <h1>Gastos de Casa</h1>
            <p>Cuánto gastamos y qué falta pagar</p>
          </div>
          <Link href="/fijos" className="g-title-link">⚙️ Fijos</Link>
        </div>
      </header>

      {/* Navegación de mes */}
      <div className="g-monthnav">
        <button onClick={() => setPeriodo(shiftPeriodo(periodo, -1))} aria-label="Mes anterior">‹</button>
        <span className="g-monthlabel">{fmtPeriodo(periodo)}</span>
        <button onClick={() => setPeriodo(shiftPeriodo(periodo, 1))} aria-label="Mes siguiente">›</button>
      </div>
      {periodo !== HOY && (
        <div className="g-hoy"><button onClick={() => setPeriodo(HOY)}>Volver al mes actual</button></div>
      )}

      {loading && !state ? (
        <div className="g-loading">Cargando…</div>
      ) : (
        <>
          {/* Resumen */}
          <div className="g-summary">
            <div className="g-summary-tot">Total del mes</div>
            <div className="g-summary-monto">{fmtMoney(total)}</div>
            <div className="g-summary-sub">
              {pendientes.length > 0
                ? <>Falta pagar <b>{fmtMoney(totalPend)}</b> · {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}</>
                : movs.length > 0 ? '✓ Todo pagado este mes' : 'Sin gastos cargados'}
            </div>
            {porPersona.length > 0 && (
              <div className="g-chips">
                {porPersona.map(p => (
                  <div key={p.nombre} className="g-chip">
                    <span className="g-chip-name">{p.nombre}</span>
                    <span className="g-chip-val">{fmtMoney(p.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Por categoría */}
          {porCategoria.length > 1 && (
            <div className="g-cats">
              {porCategoria.map(c => (
                <div key={c.nombre} className="g-cat">
                  <div className="g-cat-head">
                    <span className="g-cat-name">{c.nombre}</span>
                    <span className="g-cat-val">{fmtMoney(c.val)}</span>
                  </div>
                  <div className="g-cat-bar"><div className="g-cat-fill" style={{ width: `${(c.val / maxCat) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}

          {/* Pendientes */}
          <div className="g-sec">Pendientes <span className="g-count">{pendientes.length}</span></div>
          {pendientes.length === 0 ? (
            <div className="g-empty">Nada pendiente 🎉</div>
          ) : (
            pendientes.map(m => (
              <MovRow key={m.id} m={m} vencido={esVencido(m)}
                onToggle={togglePagado} onEdit={editar} onDelete={borrar} />
            ))
          )}

          {/* Pagados */}
          {pagados.length > 0 && (
            <>
              <div className="g-sec">Pagados <span className="g-count">{pagados.length}</span></div>
              {pagados.map(m => (
                <MovRow key={m.id} m={m} vencido={false}
                  onToggle={togglePagado} onEdit={editar} onDelete={borrar} />
              ))}
            </>
          )}

          {/* Omitidos este mes */}
          {omitidos.length > 0 && (
            <div className="g-empty" style={{ marginTop: 18 }}>
              {omitidos.length} gasto{omitidos.length !== 1 ? 's' : ''} fijo{omitidos.length !== 1 ? 's' : ''} omitido{omitidos.length !== 1 ? 's' : ''} este mes ·{' '}
              {omitidos.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && ', '}
                  <button className="g-iconbtn" style={{ color: 'var(--g)', display: 'inline' }} onClick={() => restaurar(m)}>restaurar {m.nombre}</button>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <button className="g-btn g-add-fab" onClick={nuevoVariable}>+ Gasto</button>

      {draft && (
        <MovSheet
          draft={draft} setDraft={setDraft} pagadores={pagadores}
          busy={busy} onSave={saveDraft} onCancel={() => setDraft(null)}
        />
      )}
    </div>
  )
}

function MovRow({ m, vencido, onToggle, onEdit, onDelete }: {
  m: Movimiento; vencido: boolean
  onToggle: (m: Movimiento) => void; onEdit: (m: Movimiento) => void; onDelete: (m: Movimiento) => void
}) {
  return (
    <div className={`g-mov${vencido ? ' venc' : ''}${m.pagado ? ' pagado' : ''}`}>
      <button className={`g-check${m.pagado ? ' on' : ''}`} onClick={() => onToggle(m)}
        aria-label={m.pagado ? 'Marcar como no pagado' : 'Marcar como pagado'}>✓</button>
      <div className="g-mov-info" onClick={() => onEdit(m)} style={{ cursor: 'pointer' }}>
        <div className="g-mov-name">{m.nombre}</div>
        <div className="g-mov-meta">
          {m.tipo === 'fijo' && <span className="g-tag-fijo">Fijo</span>}
          <span>{m.categoria}</span>
          <span>· {m.pagador}</span>
          {m.pagado && m.fechaPago && <span>· pagó {fmtDiaCorto(m.fechaPago)}</span>}
          {!m.pagado && m.vencimiento && (
            <span className={vencido ? 'venctxt' : ''}>· {vencido ? 'venció' : 'vence'} {fmtDiaCorto(m.vencimiento)}</span>
          )}
        </div>
      </div>
      <div className="g-mov-right">
        <span className="g-mov-monto">{fmtMoney(m.monto)}</span>
        <div className="g-mov-actions">
          <button className="g-iconbtn" onClick={() => onEdit(m)} aria-label="Editar">✏️</button>
          <button className="g-iconbtn" onClick={() => onDelete(m)} aria-label={m.tipo === 'fijo' ? 'Omitir' : 'Borrar'}>🗑️</button>
        </div>
      </div>
    </div>
  )
}

function MovSheet({ draft, setDraft, pagadores, busy, onSave, onCancel }: {
  draft: Draft; setDraft: (d: Draft) => void; pagadores: string[]
  busy: boolean; onSave: () => void; onCancel: () => void
}) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  return (
    <div className="g-sheet-back" onClick={onCancel}>
      <div className="g-sheet" onClick={e => e.stopPropagation()}>
        <h2>{draft.id ? 'Editar gasto' : 'Nuevo gasto'}</h2>

        <div className="g-field">
          <label>Descripción</label>
          <input className="g-input" value={draft.nombre} autoFocus
            placeholder="Ej: Supermercado, Luz…"
            onChange={e => set({ nombre: e.target.value })} />
        </div>

        <div className="g-row2">
          <div className="g-field">
            <label>Monto</label>
            <input className="g-input" inputMode="decimal" value={draft.monto}
              placeholder="0" onChange={e => set({ monto: e.target.value })} />
          </div>
          <div className="g-field">
            <label>Categoría</label>
            <select className="g-select" value={draft.categoria} onChange={e => set({ categoria: e.target.value })}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="g-field">
          <label>Quién paga</label>
          <div className="g-seg">
            {pagadores.map(n => (
              <button key={n} className={draft.pagador === n ? 'on' : ''} onClick={() => set({ pagador: n })}>{n}</button>
            ))}
          </div>
        </div>

        <div className="g-field">
          <label>Estado</label>
          <div className="g-seg">
            <button className={draft.pagado ? 'on' : ''} onClick={() => set({ pagado: true })}>Ya pagado</button>
            <button className={!draft.pagado ? 'on' : ''} onClick={() => set({ pagado: false })}>Pendiente</button>
          </div>
        </div>

        <div className="g-field">
          <label>{draft.pagado ? 'Fecha de pago' : 'Vence'}</label>
          <input className="g-input" type="date" value={draft.fecha}
            onChange={e => set({ fecha: e.target.value })} />
        </div>

        <div className="g-sheet-actions">
          <button className="g-btn g-ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button className="g-btn" onClick={onSave} disabled={busy || !draft.nombre.trim()}>
            {busy ? '…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
