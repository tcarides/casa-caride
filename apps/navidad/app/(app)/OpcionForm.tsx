'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { parseMoney } from '@/lib/format'

export type Moneda = 'ARS' | 'USD'

// Borrador de una opción (alternativa de un deseo) tal como se edita en el form.
export interface OpcionDraft {
  id?: number
  titulo: string
  link: string
  imagenUrl: string | null
  precioTxt: string
  moneda: Moneda
  nota: string
}

export interface OpcionPayload {
  titulo: string | null; link: string | null; imagenUrl: string | null
  precio: number | null; moneda: Moneda; nota: string | null
}

export interface OpcionExistente {
  id: number; titulo: string | null; link: string | null; imagenUrl: string | null
  precio: number | null; moneda: Moneda; nota: string | null
}

export function emptyOpcion(link = ''): OpcionDraft {
  return { titulo: '', link, imagenUrl: null, precioTxt: '', moneda: 'ARS', nota: '' }
}
export function opcionFromExisting(o: OpcionExistente): OpcionDraft {
  return {
    id: o.id, titulo: o.titulo ?? '', link: o.link ?? '', imagenUrl: o.imagenUrl,
    precioTxt: o.precio != null ? String(o.precio / 100) : '', moneda: o.moneda, nota: o.nota ?? '',
  }
}
export function isDraftEmpty(d: OpcionDraft): boolean {
  return !d.link.trim() && !d.precioTxt.trim() && !d.imagenUrl && !d.titulo.trim() && !d.nota.trim()
}
export function draftToPayload(d: OpcionDraft): OpcionPayload {
  return {
    titulo: d.titulo.trim() || null,
    link: d.link.trim() || null,
    imagenUrl: d.imagenUrl,
    precio: d.precioTxt.trim() ? parseMoney(d.precioTxt) : null,
    moneda: d.moneda,
    nota: d.nota.trim() || null,
  }
}

// Campos de una opción (link + preview, etiqueta, precio, imagen, nota).
// Controlado: el padre tiene el `value` y recibe cambios por `onChange`.
export function OpcionForm({ value, onChange, autoPreview }: {
  value: OpcionDraft; onChange: (d: OpcionDraft) => void; autoPreview?: boolean
}) {
  const [loadingPrev, setLoadingPrev] = useState(false)
  const [prevMsg, setPrevMsg] = useState<string | null>(null)
  const set = (patch: Partial<OpcionDraft>) => onChange({ ...value, ...patch })

  async function traerPreview(url: string) {
    if (!url) return
    setLoadingPrev(true); setPrevMsg(null)
    try {
      const res = await apiFetch(`/api/preview?url=${encodeURIComponent(url)}`)
      const p = (await res.json().catch(() => null))?.preview
      if (p) {
        const patch: Partial<OpcionDraft> = {}
        if (p.image) patch.imagenUrl = p.image
        if (p.title && !value.titulo.trim()) patch.titulo = p.title
        if (p.price != null && !value.precioTxt.trim()) {
          patch.precioTxt = String(p.price / 100)
          if (p.moneda) patch.moneda = p.moneda
        }
        onChange({ ...value, ...patch })
        // "Éxito" = trajo lo útil (foto o precio). Si solo vino el nombre del
        // sitio, avisamos honesto (MercadoLibre bloquea el preview desde el server).
        const trajoUtil = !!p.image || p.price != null
        setPrevMsg(trajoUtil
          ? '✓ Datos traídos del link'
          : 'Este sitio no deja traer foto ni precio (ej. MercadoLibre). Cargalos a mano 👇')
      } else { setPrevMsg('No pude leer el link; cargá los datos a mano.') }
    } catch { setPrevMsg('No pude leer el link.') } finally { setLoadingPrev(false) }
  }

  // Share target: al abrir con un link ya puesto, traer el preview solo.
  useEffect(() => {
    if (autoPreview && value.link.trim()) traerPreview(value.link.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className="nv-field">
        <label>Link del producto (opcional)</label>
        <div className="nv-link-row">
          <input className="nv-input" inputMode="url" placeholder="pegá el link…" value={value.link} onChange={(e) => set({ link: e.target.value })} />
          <button type="button" className="nv-btn nv-btn--sm" onClick={() => traerPreview(value.link.trim())} disabled={loadingPrev || !value.link.trim()}>
            {loadingPrev ? <span className="nv-spin" /> : 'Traer'}
          </button>
        </div>
        {prevMsg && <div className="nv-hint">{prevMsg}</div>}
      </div>

      {value.imagenUrl && (
        <div className="nv-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.imagenUrl} alt="" />
          <div className="nv-preview-txt"><b>{value.titulo || 'Opción'}</b>imagen de la opción</div>
          <button type="button" className="nv-icon-btn" title="Quitar imagen" style={{ marginLeft: 'auto' }} onClick={() => set({ imagenUrl: null })}>✕</button>
        </div>
      )}

      <div className="nv-field">
        <label>Imagen (URL, opcional)</label>
        <input className="nv-input" inputMode="url" placeholder="https://…/foto.jpg" value={value.imagenUrl ?? ''} onChange={(e) => set({ imagenUrl: e.target.value.trim() || null })} />
      </div>

      <div className="nv-field">
        <label>Etiqueta de la opción (opcional)</label>
        <input className="nv-input" placeholder="Ej. MercadoLibre, modelo grande…" value={value.titulo} onChange={(e) => set({ titulo: e.target.value })} />
      </div>

      <div className="nv-field">
        <label>Precio aprox. (opcional)</label>
        <div className="nv-row">
          <input className="nv-input" inputMode="decimal" placeholder="0" value={value.precioTxt} onChange={(e) => set({ precioTxt: e.target.value })} />
          <select className="nv-select" value={value.moneda} onChange={(e) => set({ moneda: e.target.value as Moneda })} style={{ maxWidth: 90 }}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div className="nv-field">
        <label>Nota de la opción (opcional)</label>
        <input className="nv-input" placeholder="Ej. color azul, usado…" value={value.nota} onChange={(e) => set({ nota: e.target.value })} />
      </div>
    </>
  )
}

// Sheet para agregar/editar UNA opción de un deseo existente.
export interface OpcionEditorState {
  deseoId: number
  opcion?: OpcionExistente
  prefillLink?: string
  autoPreview?: boolean
}

export function OpcionEditor({ state, onClose, onSaved }: {
  state: OpcionEditorState; onClose: () => void; onSaved: () => void
}) {
  const [draft, setDraft] = useState<OpcionDraft>(() =>
    state.opcion ? opcionFromExisting(state.opcion) : emptyOpcion(state.prefillLink ?? ''))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setErr(null)
    if (isDraftEmpty(draft)) { setErr('Cargá al menos un link, precio o etiqueta.'); return }
    setSaving(true)
    const payload = draftToPayload(draft)
    const res = draft.id
      ? await apiFetch(`/api/opciones/${draft.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      : await apiFetch('/api/opciones', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deseoId: state.deseoId, ...payload }) })
    if (res.ok) { onSaved() } else { setSaving(false); setErr('No se pudo guardar.') }
  }

  return (
    <div className="nv-sheet-bg" onClick={onClose}>
      <div className="nv-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{draft.id ? 'Editar opción' : 'Nueva opción'}</h3>
        <OpcionForm value={draft} onChange={setDraft} autoPreview={state.autoPreview} />
        {err && <div className="nv-hint">{err}</div>}
        <div className="nv-sheet-actions">
          <button type="button" className="nv-btn nv-btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="nv-btn nv-btn--primary" onClick={submit} disabled={saving}>
            {saving ? <span className="nv-spin" /> : (draft.id ? 'Guardar' : 'Agregar')}
          </button>
        </div>
      </div>
    </div>
  )
}
