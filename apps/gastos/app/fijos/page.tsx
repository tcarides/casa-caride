'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { CATEGORIAS, COMPARTIDO, FRECUENCIA_LABEL, MEDIOS_PAGO } from '@/lib/constants'
import { fmtMoney, parseMoney, mesCorto } from '@/lib/format'

type Frecuencia = 'mensual' | 'bimestral' | 'anual'
type Moneda = 'ARS' | 'USD'
interface GastoFijo {
  id: number; nombre: string; categoria: string; pagador: string; moneda: Moneda
  montoEstimado: number; diaVencimiento: number | null
  frecuencia: Frecuencia; mesAncla: number | null
  medioPago: string | null; notas: string | null; automatico: boolean; activo: boolean
}
interface Persona { id: number; nombre: string; orden: number }

type Draft = {
  id?: number
  nombre: string
  monto: string
  moneda: Moneda
  categoria: string
  pagador: string
  dia: string
  frecuencia: Frecuencia
  mesAncla: number
  medioPago: string
  notas: string
  automatico: boolean
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function FijosPage() {
  const [fijos, setFijos] = useState<GastoFijo[]>([])
  const [pagadores, setPagadores] = useState<string[]>([COMPARTIDO])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fRes, sRes] = await Promise.all([
        apiFetch('/api/fijos'),
        apiFetch(`/api/state?periodo=${new Date().getFullYear()}-01`),
      ])
      if (fRes.ok) setFijos(await fRes.json() as GastoFijo[])
      if (sRes.ok) {
        const s = await sRes.json() as { personas: Persona[] }
        setPagadores([...s.personas.map(p => p.nombre), COMPARTIDO])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const totalMensualArs = useMemo(
    () => fijos.filter(f => f.activo && f.frecuencia === 'mensual' && f.moneda === 'ARS').reduce((s, f) => s + f.montoEstimado, 0),
    [fijos],
  )
  const totalMensualUsd = useMemo(
    () => fijos.filter(f => f.activo && f.frecuencia === 'mensual' && f.moneda === 'USD').reduce((s, f) => s + f.montoEstimado, 0),
    [fijos],
  )

  function nuevo() {
    setDraft({
      nombre: '', monto: '', moneda: 'ARS', categoria: 'Servicios', pagador: pagadores[0] ?? COMPARTIDO,
      dia: '', frecuencia: 'mensual', mesAncla: new Date().getMonth() + 1, medioPago: '', notas: '', automatico: false,
    })
  }

  function editar(f: GastoFijo) {
    setDraft({
      id: f.id, nombre: f.nombre, monto: f.montoEstimado ? String(f.montoEstimado / 100) : '',
      moneda: f.moneda, categoria: f.categoria, pagador: f.pagador, dia: f.diaVencimiento ? String(f.diaVencimiento) : '',
      frecuencia: f.frecuencia, mesAncla: f.mesAncla ?? new Date().getMonth() + 1,
      medioPago: f.medioPago ?? '', notas: f.notas ?? '', automatico: f.automatico,
    })
  }

  async function guardar() {
    if (!draft || !draft.nombre.trim() || busy) return
    setBusy(true)
    const payload = {
      nombre: draft.nombre.trim(),
      categoria: draft.categoria,
      pagador: draft.pagador,
      moneda: draft.moneda,
      montoEstimado: parseMoney(draft.monto),
      diaVencimiento: draft.dia ? Number(draft.dia) : null,
      frecuencia: draft.frecuencia,
      mesAncla: draft.frecuencia === 'mensual' ? null : draft.mesAncla,
      medioPago: draft.medioPago.trim() || null,
      notas: draft.notas.trim() || null,
      automatico: draft.automatico,
    }
    try {
      if (draft.id) {
        await apiFetch(`/api/fijos/${draft.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      } else {
        await apiFetch('/api/fijos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      }
      setDraft(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function toggleActivo(f: GastoFijo) {
    setFijos(fs => fs.map(x => x.id === f.id ? { ...x, activo: !x.activo } : x))
    await apiFetch(`/api/fijos/${f.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !f.activo }),
    })
    await load()
  }

  async function borrar(f: GastoFijo) {
    if (!confirm(`¿Borrar el gasto fijo "${f.nombre}"? Se quita de los próximos meses (el historial pagado se conserva).`)) return
    setBusy(true)
    try {
      await apiFetch(`/api/fijos/${f.id}`, { method: 'DELETE' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function cargarSeed() {
    if (seeding) return
    setSeeding(true)
    try {
      const res = await apiFetch('/api/seed', { method: 'POST' })
      if (res.ok) {
        const { agregados } = await res.json() as { agregados: number }
        await load()
        alert(agregados > 0
          ? `Se cargaron ${agregados} gastos fijos. Completá los montos a medida que los pagues.`
          : 'Ya tenías todos cargados (no se duplicó ninguno).')
      }
    } finally {
      setSeeding(false)
    }
  }

  function frecTexto(f: GastoFijo): string {
    const base = FRECUENCIA_LABEL[f.frecuencia]
    const dia = f.diaVencimiento ? ` · vence el ${f.diaVencimiento}` : ''
    if (f.frecuencia === 'mensual') return base + dia
    if (f.frecuencia === 'anual') return `${base} (${mesCorto(f.mesAncla ?? 1)})${dia}`
    const meses: string[] = []
    for (let m = (f.mesAncla ?? 1); m <= 12; m += 2) meses.push(mesCorto(m))
    return `${base} (${meses.join(', ')})${dia}`
  }

  return (
    <div className="g">
      <header className="g-header">
        <div className="g-title">
          <span className="g-logo">🧾</span>
          <div>
            <h1>Gastos fijos</h1>
            <p>Las cuentas que se repiten cada mes</p>
          </div>
          <Link href="/" className="g-title-link">← Mes</Link>
        </div>
      </header>

      {loading ? (
        <div className="g-loading">Cargando…</div>
      ) : (
        <>
          {fijos.length > 0 && (
            <div className="g-summary" style={{ marginBottom: 16 }}>
              <div className="g-summary-tot">Fijos mensuales (estimado)</div>
              <div className="g-summary-monto">{fmtMoney(totalMensualArs)}</div>
              {totalMensualUsd > 0 && <div className="g-summary-sub">+ {fmtMoney(totalMensualUsd, 'USD')} en dólares</div>}
              <div className="g-summary-sub">Sin contar bimestrales ni anuales</div>
            </div>
          )}

          {fijos.length === 0 ? (
            <div className="g-empty" style={{ padding: '28px 8px' }}>
              Todavía no cargaste gastos fijos.<br />
              <button className="g-btn" style={{ marginTop: 14 }} onClick={cargarSeed} disabled={seeding}>
                {seeding ? 'Cargando…' : '⚡ Cargar mis gastos fijos de casa'}
              </button>
              <div style={{ marginTop: 12, fontSize: '0.8rem' }}>o agregalos uno por uno con el botón de abajo</div>
            </div>
          ) : (
            fijos.map(f => (
              <div key={f.id} className={`g-fijo${f.activo ? '' : ' off'}`}>
                <label className="g-switch" title={f.activo ? 'Activo' : 'Pausado'}>
                  <input type="checkbox" checked={f.activo} onChange={() => toggleActivo(f)} />
                  <span className="g-switch-tr" />
                </label>
                <div className="g-fijo-info" onClick={() => editar(f)} style={{ cursor: 'pointer' }}>
                  <div className="g-fijo-name">
                    {f.nombre}
                    {f.automatico && <span className="g-auto">auto</span>}
                  </div>
                  <div className="g-fijo-meta">{f.categoria} · {f.pagador} · {frecTexto(f)}</div>
                  {(f.medioPago || f.notas) && (
                    <div className="g-fijo-meta g-fijo-extra">
                      {f.medioPago && <>💳 {f.medioPago}</>}
                      {f.medioPago && f.notas && ' · '}
                      {f.notas && <>{f.notas}</>}
                    </div>
                  )}
                </div>
                <span className="g-fijo-monto">{fmtMoney(f.montoEstimado, f.moneda)}</span>
                <button className="g-iconbtn" onClick={() => borrar(f)} aria-label="Borrar">🗑️</button>
              </div>
            ))
          )}
        </>
      )}

      <button className="g-btn g-add-fab" onClick={nuevo}>+ Gasto fijo</button>

      {draft && (
        <FijoSheet
          draft={draft} setDraft={setDraft} pagadores={pagadores}
          busy={busy} onSave={guardar} onCancel={() => setDraft(null)} meses={MESES}
        />
      )}
    </div>
  )
}

function FijoSheet({ draft, setDraft, pagadores, busy, onSave, onCancel, meses }: {
  draft: Draft; setDraft: (d: Draft) => void; pagadores: string[]
  busy: boolean; onSave: () => void; onCancel: () => void; meses: string[]
}) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const frecs: Frecuencia[] = ['mensual', 'bimestral', 'anual']
  return (
    <div className="g-sheet-back" onClick={onCancel}>
      <div className="g-sheet" onClick={e => e.stopPropagation()}>
        <h2>{draft.id ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</h2>

        <div className="g-field">
          <label>Nombre</label>
          <input className="g-input" value={draft.nombre} autoFocus
            placeholder="Ej: Luz, Gas, Expensas, Internet…"
            onChange={e => set({ nombre: e.target.value })} />
        </div>

        <div className="g-row2">
          <div className="g-field">
            <label>Monto estimado</label>
            <input className="g-input" inputMode="decimal" value={draft.monto}
              placeholder="0" onChange={e => set({ monto: e.target.value })} />
          </div>
          <div className="g-field" style={{ maxWidth: 120 }}>
            <label>Moneda</label>
            <div className="g-seg">
              <button className={draft.moneda === 'ARS' ? 'on' : ''} onClick={() => set({ moneda: 'ARS' })}>$</button>
              <button className={draft.moneda === 'USD' ? 'on' : ''} onClick={() => set({ moneda: 'USD' })}>US$</button>
            </div>
          </div>
        </div>

        <div className="g-field">
          <label>Categoría</label>
          <select className="g-select" value={draft.categoria} onChange={e => set({ categoria: e.target.value })}>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
          <label>Medio de pago</label>
          <input className="g-input" list="medios-pago" value={draft.medioPago}
            placeholder="Ej: Mercado Pago, Transferencia…" onChange={e => set({ medioPago: e.target.value })} />
          <datalist id="medios-pago">
            {MEDIOS_PAGO.map(m => <option key={m} value={m} />)}
          </datalist>
        </div>

        <div className="g-field">
          <label>Notas (N° de cliente, alias, etc.)</label>
          <input className="g-input" value={draft.notas}
            placeholder="Ej: N° cliente 123456, alias Ferias26…" onChange={e => set({ notas: e.target.value })} />
        </div>

        <label className="g-checkrow">
          <input type="checkbox" checked={draft.automatico} onChange={e => set({ automatico: e.target.checked })} />
          <span>Se cobra solo (tarjeta / débito automático)</span>
        </label>

        <div className="g-field">
          <label>Frecuencia</label>
          <div className="g-seg">
            {frecs.map(fr => (
              <button key={fr} className={draft.frecuencia === fr ? 'on' : ''} onClick={() => set({ frecuencia: fr })}>
                {FRECUENCIA_LABEL[fr]}
              </button>
            ))}
          </div>
        </div>

        <div className="g-row2">
          <div className="g-field">
            <label>Día de vencimiento</label>
            <input className="g-input" inputMode="numeric" value={draft.dia}
              placeholder="ej: 10" onChange={e => set({ dia: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
          </div>
          {draft.frecuencia !== 'mensual' && (
            <div className="g-field">
              <label>{draft.frecuencia === 'anual' ? 'Mes' : 'Empieza en'}</label>
              <select className="g-select" value={draft.mesAncla} onChange={e => set({ mesAncla: Number(e.target.value) })}>
                {meses.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}
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
