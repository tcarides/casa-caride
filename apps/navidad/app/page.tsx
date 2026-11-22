'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { fmtMoney, parseMoney, linkHost } from '@/lib/format'

type Moneda = 'ARS' | 'USD'
type Prioridad = 'alta' | 'media' | 'baja'

interface Deseo {
  id: number; participanteId: number; titulo: string; link: string | null; imagenUrl: string | null
  precio: number | null; moneda: Moneda; prioridad: Prioridad; nota: string | null; createdAt: string
}
interface Participante { id: number; grupoId: number; nombre: string; emoji: string | null; orden: number; deseos: Deseo[] }
interface Grupo { id: number; nombre: string; createdAt: string; nParticipantes?: number; nDeseos?: number }
interface GrupoDetalle extends Grupo { participantes: Participante[] }

const PRIO_LABEL: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

export default function NavidadPage() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [grupo, setGrupo] = useState<GrupoDetalle | null>(null)
  const [busy, setBusy] = useState(false)
  const [nuevoGrupo, setNuevoGrupo] = useState<string | null>(null) // null = cerrado
  const [editor, setEditor] = useState<DeseoEditorState | null>(null)

  const loadGrupos = useCallback(async () => {
    const res = await apiFetch('/api/grupos')
    if (res.ok) setGrupos((await res.json()).grupos as Grupo[])
  }, [])

  const openGrupo = useCallback(async (id: number) => {
    setBusy(true)
    try {
      const res = await apiFetch(`/api/grupos/${id}`)
      if (res.ok) setGrupo((await res.json()).grupo as GrupoDetalle)
    } finally { setBusy(false) }
  }, [])

  const reloadGrupo = useCallback(async () => {
    if (grupo) await openGrupo(grupo.id)
  }, [grupo, openGrupo])

  useEffect(() => { loadGrupos() }, [loadGrupos])

  // ── Grupos ──
  async function crearGrupo(nombre: string) {
    const n = nombre.trim()
    if (!n) return
    setBusy(true)
    try {
      const res = await apiFetch('/api/grupos', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nombre: n }),
      })
      if (res.ok) { setNuevoGrupo(null); await loadGrupos(); await openGrupo((await res.json()).id) }
    } finally { setBusy(false) }
  }
  async function renombrarGrupo() {
    if (!grupo) return
    const nombre = prompt('Nombre del grupo', grupo.nombre)?.trim()
    if (!nombre || nombre === grupo.nombre) return
    await apiFetch(`/api/grupos/${grupo.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nombre }) })
    await reloadGrupo(); await loadGrupos()
  }
  async function borrarGrupo() {
    if (!grupo) return
    if (!confirm(`¿Borrar el grupo "${grupo.nombre}" y todas sus listas?`)) return
    await apiFetch(`/api/grupos/${grupo.id}`, { method: 'DELETE' })
    setGrupo(null); await loadGrupos()
  }

  // ── Participantes ──
  async function agregarParticipante() {
    if (!grupo) return
    const nombre = prompt('Nombre de la persona')?.trim()
    if (!nombre) return
    await apiFetch('/api/participantes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grupoId: grupo.id, nombre }) })
    await reloadGrupo()
  }
  async function renombrarParticipante(p: Participante) {
    const nombre = prompt('Nombre', p.nombre)?.trim()
    if (!nombre || nombre === p.nombre) return
    await apiFetch(`/api/participantes/${p.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nombre }) })
    await reloadGrupo()
  }
  async function borrarParticipante(p: Participante) {
    if (!confirm(`¿Quitar a ${p.nombre} y su lista?`)) return
    await apiFetch(`/api/participantes/${p.id}`, { method: 'DELETE' })
    await reloadGrupo()
  }

  // ── Deseos ──
  async function guardarDeseo(data: DeseoPayload, id?: number) {
    const url = id ? `/api/deseos/${id}` : '/api/deseos'
    const method = id ? 'PATCH' : 'POST'
    const res = await apiFetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
    if (res.ok) { setEditor(null); await reloadGrupo() }
    return res.ok
  }
  async function borrarDeseo(d: Deseo) {
    if (!confirm('¿Borrar este deseo?')) return
    await apiFetch(`/api/deseos/${d.id}`, { method: 'DELETE' })
    await reloadGrupo()
  }

  // ── Render ──
  if (grupo) {
    return (
      <main className="nv">
        <GrupoView
          grupo={grupo} busy={busy}
          onBack={() => setGrupo(null)}
          onRename={renombrarGrupo} onDelete={borrarGrupo}
          onAddPart={agregarParticipante}
          onRenamePart={renombrarParticipante} onDeletePart={borrarParticipante}
          onAddDeseo={(pid) => setEditor({ participanteId: pid })}
          onEditDeseo={(d) => setEditor({ participanteId: d.participanteId, deseo: d })}
          onDeleteDeseo={borrarDeseo}
        />
        {editor && (
          <DeseoEditor
            key={editor.deseo?.id ?? 'new'}
            state={editor}
            onClose={() => setEditor(null)}
            onSave={guardarDeseo}
          />
        )}
      </main>
    )
  }

  return (
    <main className="nv">
      <header className="nv-header">
        <div className="nv-title">
          <span className="nv-logo" aria-hidden>🎄</span>
          <div>
            <h1>Regalos de Navidad</h1>
            <p>Las listas de la familia</p>
          </div>
        </div>
      </header>

      {grupos === null ? (
        <div className="nv-loading"><span className="nv-spin" /></div>
      ) : (
        <>
          <div className="nv-grupos">
            {grupos.map((g) => (
              <button key={g.id} className="nv-grupo-card" onClick={() => openGrupo(g.id)}>
                <span className="nv-chev" aria-hidden>›</span>
                <h3><span aria-hidden>🎁</span>{g.nombre}</h3>
                <div className="nv-meta">
                  {g.nParticipantes ?? 0} {(g.nParticipantes ?? 0) === 1 ? 'persona' : 'personas'}
                  {' · '}{g.nDeseos ?? 0} {(g.nDeseos ?? 0) === 1 ? 'deseo' : 'deseos'}
                </div>
              </button>
            ))}
            {grupos.length === 0 && nuevoGrupo === null && (
              <div className="nv-empty">Todavía no hay grupos.<br />Creá uno para empezar las listas. 🎄</div>
            )}
          </div>

          {nuevoGrupo !== null ? (
            <NuevoGrupoForm
              value={nuevoGrupo} onChange={setNuevoGrupo} busy={busy}
              onCancel={() => setNuevoGrupo(null)} onSubmit={() => crearGrupo(nuevoGrupo)}
            />
          ) : (
            <button className="nv-btn nv-btn--primary nv-btn--block nv-add-row" onClick={() => setNuevoGrupo('')}>
              + Nuevo grupo
            </button>
          )}
        </>
      )}
    </main>
  )
}

// ── Nuevo grupo (inline) ──
function NuevoGrupoForm({ value, onChange, onSubmit, onCancel, busy }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void; busy: boolean
}) {
  return (
    <form className="nv-add-row nv-link-row" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <input
        className="nv-input" autoFocus placeholder="Ej. Navidad Caride 2026"
        value={value} onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm" onClick={onCancel}>✕</button>
      <button type="submit" className="nv-btn nv-btn--primary nv-btn--sm" disabled={busy || !value.trim()}>Crear</button>
    </form>
  )
}

// ── Vista de un grupo ──
function GrupoView({ grupo, busy, onBack, onRename, onDelete, onAddPart, onRenamePart, onDeletePart, onAddDeseo, onEditDeseo, onDeleteDeseo }: {
  grupo: GrupoDetalle; busy: boolean
  onBack: () => void; onRename: () => void; onDelete: () => void
  onAddPart: () => void; onRenamePart: (p: Participante) => void; onDeletePart: (p: Participante) => void
  onAddDeseo: (pid: number) => void; onEditDeseo: (d: Deseo) => void; onDeleteDeseo: (d: Deseo) => void
}) {
  return (
    <>
      <header className="nv-header">
        <button className="nv-back" onClick={onBack}>‹ Grupos</button>
        <div className="nv-title">
          <span className="nv-logo" aria-hidden>🎁</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{grupo.nombre}</h1>
            <p>{grupo.participantes.length} {grupo.participantes.length === 1 ? 'persona' : 'personas'}</p>
          </div>
          <button className="nv-icon-btn" title="Renombrar" onClick={onRename}>✏️</button>
          <button className="nv-icon-btn" title="Borrar grupo" onClick={onDelete}>🗑️</button>
        </div>
      </header>

      {grupo.participantes.length === 0 && (
        <div className="nv-empty">Sumá a las personas del grupo para armar sus listas.</div>
      )}

      {grupo.participantes.map((p) => (
        <section className="nv-part" key={p.id}>
          <div className="nv-part-head">
            <span className="nv-part-avatar" aria-hidden>{p.emoji || inicial(p.nombre)}</span>
            <h2>{p.nombre}</h2>
            <span className="nv-part-count">{p.deseos.length}</span>
            <div className="nv-part-actions">
              <button className="nv-icon-btn" title="Editar" onClick={() => onRenamePart(p)}>✏️</button>
              <button className="nv-icon-btn" title="Quitar" onClick={() => onDeletePart(p)}>🗑️</button>
            </div>
          </div>

          <div className="nv-deseos">
            {p.deseos.map((d) => (
              <DeseoCard key={d.id} deseo={d} onEdit={() => onEditDeseo(d)} onDelete={() => onDeleteDeseo(d)} />
            ))}
          </div>

          <button className="nv-btn nv-btn--sm nv-add-row" onClick={() => onAddDeseo(p.id)}>+ Deseo</button>
        </section>
      ))}

      <button className="nv-btn nv-btn--block nv-add-row" onClick={onAddPart} disabled={busy}>+ Agregar persona</button>
    </>
  )
}

function DeseoCard({ deseo: d, onEdit, onDelete }: { deseo: Deseo; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="nv-deseo">
      {d.imagenUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="nv-deseo-img" src={d.imagenUrl} alt="" loading="lazy" />
        : <div className="nv-deseo-img nv-deseo-img--ph" aria-hidden>🎁</div>}
      <div className="nv-deseo-body">
        <div className="nv-deseo-top">
          <div className="nv-deseo-title">{d.titulo}</div>
          {d.precio != null && <div className="nv-deseo-price">{fmtMoney(d.precio, d.moneda)}</div>}
          <div className="nv-deseo-actions">
            <button className="nv-icon-btn" title="Editar" onClick={onEdit}>✏️</button>
            <button className="nv-icon-btn" title="Borrar" onClick={onDelete}>🗑️</button>
          </div>
        </div>
        <div className="nv-deseo-sub">
          <span className={`nv-prio nv-prio--${d.prioridad}`}>{PRIO_LABEL[d.prioridad]}</span>
          {d.link && (
            <a className="nv-deseo-link" href={d.link} target="_blank" rel="noopener noreferrer">↗ {linkHost(d.link)}</a>
          )}
        </div>
        {d.nota && <div className="nv-deseo-nota">{d.nota}</div>}
      </div>
    </div>
  )
}

// ── Editor de deseo (bottom sheet) ──
interface DeseoEditorState { participanteId: number; deseo?: Deseo }
interface DeseoPayload {
  participanteId: number; titulo: string; link: string | null; imagenUrl: string | null
  precio: number | null; moneda: Moneda; prioridad: Prioridad; nota: string | null
}

function DeseoEditor({ state, onClose, onSave }: {
  state: DeseoEditorState
  onClose: () => void
  onSave: (data: DeseoPayload, id?: number) => Promise<boolean>
}) {
  const d = state.deseo
  const [link, setLink] = useState(d?.link ?? '')
  const [titulo, setTitulo] = useState(d?.titulo ?? '')
  const [imagenUrl, setImagenUrl] = useState<string | null>(d?.imagenUrl ?? null)
  const [precioTxt, setPrecioTxt] = useState(d?.precio != null ? String(d.precio / 100) : '')
  const [moneda, setMoneda] = useState<Moneda>(d?.moneda ?? 'ARS')
  const [prioridad, setPrioridad] = useState<Prioridad>(d?.prioridad ?? 'media')
  const [nota, setNota] = useState(d?.nota ?? '')
  const [loadingPrev, setLoadingPrev] = useState(false)
  const [prevMsg, setPrevMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function traerPreview() {
    const url = link.trim()
    if (!url) return
    setLoadingPrev(true); setPrevMsg(null)
    try {
      const res = await apiFetch(`/api/preview?url=${encodeURIComponent(url)}`)
      const data = await res.json().catch(() => null)
      const p = data?.preview
      if (p) {
        if (p.image) setImagenUrl(p.image)
        if (p.title && !titulo.trim()) setTitulo(p.title)
        if (p.price != null && !precioTxt.trim()) { setPrecioTxt(String(p.price / 100)); if (p.moneda) setMoneda(p.moneda) }
        setPrevMsg(p.image || p.title ? '✓ Datos traídos del link' : 'No encontré preview; cargalo a mano.')
      } else {
        setPrevMsg('No encontré preview; cargalo a mano.')
      }
    } catch {
      setPrevMsg('No pude leer el link.')
    } finally { setLoadingPrev(false) }
  }

  async function submit() {
    const t = titulo.trim()
    const l = link.trim()
    if (!t && !l) { setPrevMsg('Poné un título o un link.'); return }
    setSaving(true)
    const ok = await onSave({
      participanteId: state.participanteId,
      titulo: t || l,
      link: l || null,
      imagenUrl,
      precio: precioTxt.trim() ? parseMoney(precioTxt) : null,
      moneda, prioridad,
      nota: nota.trim() || null,
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
            <button type="button" className="nv-btn nv-btn--sm" onClick={traerPreview} disabled={loadingPrev || !link.trim()}>
              {loadingPrev ? <span className="nv-spin" /> : 'Traer'}
            </button>
          </div>
          {prevMsg && <div className="nv-hint">{prevMsg}</div>}
        </div>

        {imagenUrl && (
          <div className="nv-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagenUrl} alt="" />
            <div className="nv-preview-txt">
              <b>{titulo || 'Producto'}</b>
              imagen del preview
            </div>
            <button type="button" className="nv-icon-btn" title="Quitar imagen" style={{ marginLeft: 'auto' }} onClick={() => setImagenUrl(null)}>✕</button>
          </div>
        )}

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

function inicial(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase() || '🎁'
}
