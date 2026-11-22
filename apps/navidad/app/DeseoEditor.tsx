'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { parseMoney } from '@/lib/format'

export type Moneda = 'ARS' | 'USD'
export type Prioridad = 'alta' | 'media' | 'baja'

const PRIO_LABEL: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

export interface EditorDeseo {
  id: number; titulo: string; link: string | null; imagenUrl: string | null
  precio: number | null; moneda: Moneda; prioridad: Prioridad; nota: string | null
}

export interface DeseoEditorState {
  participanteId: number
  deseo?: EditorDeseo
  prefillLink?: string   // para "agregar desde compartir": link ya puesto
  autoPreview?: boolean  // traer el preview solo al abrir
}

export interface DeseoPayload {
  participanteId: number; titulo: string; link: string | null; imagenUrl: string | null
  precio: number | null; moneda: Moneda; prioridad: Prioridad; nota: string | null
}

export function DeseoEditor({ state, onClose, onSave }: {
  state: DeseoEditorState; onClose: () => void; onSave: (data: DeseoPayload, id?: number) => Promise<boolean>
}) {
  const d = state.deseo
  const [link, setLink] = useState(d?.link ?? state.prefillLink ?? '')
  const [titulo, setTitulo] = useState(d?.titulo ?? '')
  const [imagenUrl, setImagenUrl] = useState<string | null>(d?.imagenUrl ?? null)
  const [precioTxt, setPrecioTxt] = useState(d?.precio != null ? String(d.precio / 100) : '')
  const [moneda, setMoneda] = useState<Moneda>(d?.moneda ?? 'ARS')
  const [prioridad, setPrioridad] = useState<Prioridad>(d?.prioridad ?? 'media')
  const [nota, setNota] = useState(d?.nota ?? '')
  const [loadingPrev, setLoadingPrev] = useState(false)
  const [prevMsg, setPrevMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function traerPreview(url: string) {
    if (!url) return
    setLoadingPrev(true); setPrevMsg(null)
    try {
      const res = await apiFetch(`/api/preview?url=${encodeURIComponent(url)}`)
      const p = (await res.json().catch(() => null))?.preview
      if (p) {
        if (p.image) setImagenUrl(p.image)
        if (p.title) setTitulo((t) => t.trim() ? t : p.title)
        if (p.price != null) {
          setPrecioTxt((t) => t.trim() ? t : String(p.price / 100))
          if (p.moneda) setMoneda(p.moneda)
        }
        setPrevMsg(p.image || p.title ? '✓ Datos traídos del link' : 'No encontré preview; cargalo a mano.')
      } else { setPrevMsg('No encontré preview; cargalo a mano.') }
    } catch { setPrevMsg('No pude leer el link.') } finally { setLoadingPrev(false) }
  }

  // Share target: al abrir con un link ya puesto, traer el preview solo.
  useEffect(() => {
    if (state.autoPreview && state.prefillLink && !d) traerPreview(state.prefillLink)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit() {
    const t = titulo.trim(); const l = link.trim()
    if (!t && !l) { setPrevMsg('Poné un título o un link.'); return }
    setSaving(true)
    const ok = await onSave({
      participanteId: state.participanteId,
      titulo: t || l, link: l || null, imagenUrl,
      precio: precioTxt.trim() ? parseMoney(precioTxt) : null,
      moneda, prioridad, nota: nota.trim() || null,
    }, d?.id)
    if (!ok) { setSaving(false); setPrevMsg('No se pudo guardar.') }
  }

  return (
    <div className="nv-sheet-bg" onClick={onClose}>
      <div className="nv-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{d ? 'Editar deseo' : 'Nuevo deseo'}</h3>

        <div className="nv-field">
          <label>Link del producto (opcional)</label>
          <div className="nv-link-row">
            <input className="nv-input" inputMode="url" placeholder="pegá el link…" value={link} onChange={(e) => setLink(e.target.value)} />
            <button type="button" className="nv-btn nv-btn--sm" onClick={() => traerPreview(link.trim())} disabled={loadingPrev || !link.trim()}>
              {loadingPrev ? <span className="nv-spin" /> : 'Traer'}
            </button>
          </div>
          {prevMsg && <div className="nv-hint">{prevMsg}</div>}
        </div>

        {imagenUrl && (
          <div className="nv-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagenUrl} alt="" />
            <div className="nv-preview-txt"><b>{titulo || 'Producto'}</b>imagen del deseo</div>
            <button type="button" className="nv-icon-btn" title="Quitar imagen" style={{ marginLeft: 'auto' }} onClick={() => setImagenUrl(null)}>✕</button>
          </div>
        )}

        <div className="nv-field">
          <label>Imagen (URL, opcional)</label>
          <input className="nv-input" inputMode="url" placeholder="https://…/foto.jpg" value={imagenUrl ?? ''} onChange={(e) => setImagenUrl(e.target.value.trim() || null)} />
        </div>

        <div className="nv-field">
          <label>Título</label>
          <input className="nv-input" placeholder="Qué querés" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>

        <div className="nv-field">
          <label>Precio aprox. (opcional)</label>
          <div className="nv-row">
            <input className="nv-input" inputMode="decimal" placeholder="0" value={precioTxt} onChange={(e) => setPrecioTxt(e.target.value)} />
            <select className="nv-select" value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)} style={{ maxWidth: 90 }}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div className="nv-field">
          <label>Prioridad</label>
          <div className="nv-prio-pick">
            {(['alta', 'media', 'baja'] as Prioridad[]).map((p) => (
              <button key={p} type="button" data-on={prioridad === p} onClick={() => setPrioridad(p)}>{PRIO_LABEL[p]}</button>
            ))}
          </div>
        </div>

        <div className="nv-field">
          <label>Nota (talle, color, modelo…)</label>
          <textarea className="nv-textarea" placeholder="Opcional" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>

        <div className="nv-sheet-actions">
          <button type="button" className="nv-btn nv-btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="nv-btn nv-btn--primary" onClick={submit} disabled={saving}>
            {saving ? <span className="nv-spin" /> : (d ? 'Guardar' : 'Agregar')}
          </button>
        </div>
      </div>
    </div>
  )
}
