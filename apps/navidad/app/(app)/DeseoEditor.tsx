'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { OpcionForm, emptyOpcion, isDraftEmpty, draftToPayload, type OpcionDraft } from './OpcionForm'

export type Moneda = 'ARS' | 'USD'
export type Prioridad = 'alta' | 'media' | 'baja'

const PRIO_LABEL: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

export interface EditorDeseo {
  id: number; titulo: string; prioridad: Prioridad; nota: string | null
}

export interface DeseoEditorState {
  participanteId: number
  deseo?: EditorDeseo       // si viene, es edición del concepto (sin opciones)
  prefillLink?: string      // "agregar desde compartir": link de la 1ª opción
  autoPreview?: boolean      // traer el preview solo al abrir
}

export function DeseoEditor({ state, onClose, onSaved }: {
  state: DeseoEditorState; onClose: () => void; onSaved: () => void
}) {
  const d = state.deseo
  const esNuevo = !d
  const [titulo, setTitulo] = useState(d?.titulo ?? '')
  const [prioridad, setPrioridad] = useState<Prioridad>(d?.prioridad ?? 'media')
  const [nota, setNota] = useState(d?.nota ?? '')
  const [opcion, setOpcion] = useState<OpcionDraft>(() => emptyOpcion(state.prefillLink ?? ''))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setErr(null)
    if (esNuevo) {
      const op = draftToPayload(opcion)
      let t = titulo.trim()
      if (!t) t = op.link ?? ''  // sin título → usamos el link de la 1ª opción
      if (!t) { setErr('Poné un título o un link.'); return }
      setSaving(true)
      const res = await apiFetch('/api/deseos', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          participanteId: state.participanteId,
          titulo: t, prioridad, nota: nota.trim() || null,
          opciones: isDraftEmpty(opcion) ? [] : [op],
        }),
      })
      if (res.ok) onSaved(); else { setSaving(false); setErr('No se pudo guardar.') }
    } else {
      const t = titulo.trim()
      if (!t) { setErr('Poné un título.'); return }
      setSaving(true)
      const res = await apiFetch(`/api/deseos/${d!.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ titulo: t, prioridad, nota: nota.trim() || null }),
      })
      if (res.ok) onSaved(); else { setSaving(false); setErr('No se pudo guardar.') }
    }
  }

  return (
    <div className="nv-sheet-bg" onClick={onClose}>
      <div className="nv-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{d ? 'Editar deseo' : 'Nuevo deseo'}</h3>

        <div className="nv-field">
          <label>Título</label>
          <input className="nv-input" autoFocus placeholder="Qué querés (ej. Lona para el jardín)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
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
          <label>Nota general (opcional)</label>
          <textarea className="nv-textarea" placeholder="Algo que aplique a todo el deseo (talle, color…)" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>

        {esNuevo && (
          <>
            <div className="nv-sheet-sep">Primera opción · podés sumar más después</div>
            <OpcionForm value={opcion} onChange={setOpcion} autoPreview={state.autoPreview} />
          </>
        )}

        {err && <div className="nv-hint">{err}</div>}

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
