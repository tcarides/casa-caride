'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { fmtMoney, linkHost } from '@/lib/format'
import { DeseoEditor, type DeseoEditorState, type DeseoPayload } from './DeseoEditor'

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
const BASE = '/navidad'

/** Link compartible de un grupo (para fijar en WhatsApp). */
function grupoUrl(id: number): string {
  if (typeof window === 'undefined') return `${BASE}?g=${id}`
  return `${window.location.origin}${BASE}?g=${id}`
}

// ── Totales / texto para exportar ──
function resumen(deseos: Deseo[]): string {
  const n = deseos.length
  const sums: Partial<Record<Moneda, number>> = {}
  for (const d of deseos) if (d.precio != null) sums[d.moneda] = (sums[d.moneda] ?? 0) + d.precio
  const base = `${n} ${n === 1 ? 'deseo' : 'deseos'}`
  const totals = (Object.entries(sums) as [Moneda, number][]).map(([m, c]) => fmtMoney(c, m))
  return totals.length ? `${base} · ${totals.join(' · ')}` : base
}
function lineaDeseo(d: Deseo): string {
  const precio = d.precio != null ? ` — ${fmtMoney(d.precio, d.moneda)}` : ''
  const nota = d.nota ? ` (${d.nota})` : ''
  const link = d.link ? ` — ${d.link}` : ''
  return `• ${d.titulo}${precio}${nota}${link}`
}
function textoParticipante(grupoNombre: string, p: Participante): string {
  const body = p.deseos.length ? p.deseos.map(lineaDeseo).join('\n') : '(sin deseos todavía)'
  return `🎄 ${grupoNombre} — ${p.nombre}\n${body}`
}
function textoGrupo(g: GrupoDetalle): string {
  const bloques = g.participantes.map((p) =>
    `${p.emoji ? p.emoji + ' ' : ''}${p.nombre}\n${p.deseos.length ? p.deseos.map(lineaDeseo).join('\n') : '(sin deseos)'}`)
  return `🎄 ${g.nombre}\n\n${bloques.join('\n\n')}`
}

export default function NavidadPage() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [grupo, setGrupo] = useState<GrupoDetalle | null>(null)
  const [busy, setBusy] = useState(false)
  const [nuevoGrupo, setNuevoGrupo] = useState<string | null>(null)
  const [editor, setEditor] = useState<DeseoEditorState | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const loadGrupos = useCallback(async () => {
    const res = await apiFetch('/api/grupos')
    if (res.ok) setGrupos((await res.json()).grupos as Grupo[])
  }, [])

  const openGrupo = useCallback(async (id: number) => {
    setBusy(true)
    try {
      const res = await apiFetch(`/api/grupos/${id}`)
      if (res.ok) setGrupo((await res.json()).grupo as GrupoDetalle)
      else setGrupo(null)
    } finally { setBusy(false) }
  }, [])

  const reloadGrupo = useCallback(async () => {
    if (grupo) await openGrupo(grupo.id)
  }, [grupo, openGrupo])

  const abrirGrupo = useCallback((id: number) => {
    history.pushState({}, '', `${BASE}?g=${id}`)
    openGrupo(id)
  }, [openGrupo])

  const volverAGrupos = useCallback(() => {
    history.pushState({}, '', BASE)
    setGrupo(null)
  }, [])

  useEffect(() => {
    loadGrupos()
    const idDesdeUrl = () => {
      const g = new URLSearchParams(window.location.search).get('g')
      return g && /^\d+$/.test(g) ? Number(g) : null
    }
    const inicial = idDesdeUrl()
    if (inicial) openGrupo(inicial)
    const onPop = () => {
      const g = idDesdeUrl()
      if (g) openGrupo(g); else setGrupo(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [loadGrupos, openGrupo])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600)
  }, [])

  // ── Compartir / exportar ──
  async function compartirGrupo() {
    if (!grupo) return
    const url = grupoUrl(grupo.id)
    const data = { title: `🎄 ${grupo.nombre}`, text: `Lista de regalos de Navidad: ${grupo.nombre}`, url }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share(data) } catch { /* cancelado */ }
      return
    }
    try { await navigator.clipboard.writeText(url); showToast('Link copiado ✓') } catch { showToast(url) }
  }
  async function copiarTexto(texto: string, okMsg: string) {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ text: texto }) } catch { /* cancelado */ }
      return
    }
    try { await navigator.clipboard.writeText(texto); showToast(okMsg) } catch { showToast('No pude copiar') }
  }

  // ── Grupos ──
  async function crearGrupo(nombre: string) {
    const n = nombre.trim()
    if (!n) return
    setBusy(true)
    try {
      const res = await apiFetch('/api/grupos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nombre: n }) })
      if (res.ok) { setNuevoGrupo(null); await loadGrupos(); abrirGrupo((await res.json()).id) }
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
    volverAGrupos(); await loadGrupos()
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
    const res = await apiFetch(url, { method: id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
    if (res.ok) { setEditor(null); await reloadGrupo() }
    return res.ok
  }
  async function borrarDeseo(d: Deseo) {
    if (!confirm('¿Borrar este deseo?')) return
    await apiFetch(`/api/deseos/${d.id}`, { method: 'DELETE' })
    await reloadGrupo()
  }
  // Refresca precio e imagen volviendo a leer el link.
  async function refrescarDeseo(d: Deseo) {
    if (!d.link) return
    showToast('Actualizando…')
    try {
      const res = await apiFetch(`/api/preview?url=${encodeURIComponent(d.link)}`)
      const p = (await res.json().catch(() => null))?.preview
      if (!p) { showToast('No pude leer el link'); return }
      const patch: DeseoPatchBody = {}
      if (p.price != null) { patch.precio = p.price; if (p.moneda) patch.moneda = p.moneda }
      if (p.image) patch.imagenUrl = p.image
      if (Object.keys(patch).length === 0) { showToast('Sin cambios'); return }
      await apiFetch(`/api/deseos/${d.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
      await reloadGrupo(); showToast('Actualizado ✓')
    } catch { showToast('No pude actualizar') }
  }

  // ── Render ──
  if (grupo) {
    return (
      <main className="nv">
        <GrupoView
          grupo={grupo} busy={busy}
          onBack={volverAGrupos}
          onShare={compartirGrupo}
          onCopyGroup={() => copiarTexto(textoGrupo(grupo), 'Lista copiada ✓')}
          onCopyPart={(p) => copiarTexto(textoParticipante(grupo.nombre, p), `Lista de ${p.nombre} copiada ✓`)}
          onRename={renombrarGrupo} onDelete={borrarGrupo}
          onAddPart={agregarParticipante}
          onRenamePart={renombrarParticipante} onDeletePart={borrarParticipante}
          onAddDeseo={(pid) => setEditor({ participanteId: pid })}
          onEditDeseo={(d) => setEditor({ participanteId: d.participanteId, deseo: d })}
          onDeleteDeseo={borrarDeseo}
          onRefreshDeseo={refrescarDeseo}
        />
        {editor && (
          <DeseoEditor key={editor.deseo?.id ?? 'new'} state={editor} onClose={() => setEditor(null)} onSave={guardarDeseo} />
        )}
        {toast && <div className="nv-toast">{toast}</div>}
      </main>
    )
  }

  return (
    <main className="nv">
      <header className="nv-header">
        <div className="nv-title">
          <span className="nv-logo" aria-hidden>🎄</span>
          <div><h1>Regalos de Navidad</h1><p>Las listas de la familia</p></div>
        </div>
      </header>

      {grupos === null ? (
        <div className="nv-loading"><span className="nv-spin" /></div>
      ) : (
        <>
          <div className="nv-grupos">
            {grupos.map((g) => (
              <button key={g.id} className="nv-grupo-card" onClick={() => abrirGrupo(g.id)}>
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
            <NuevoGrupoForm value={nuevoGrupo} onChange={setNuevoGrupo} busy={busy} onCancel={() => setNuevoGrupo(null)} onSubmit={() => crearGrupo(nuevoGrupo)} />
          ) : (
            <button className="nv-btn nv-btn--primary nv-btn--block nv-add-row" onClick={() => setNuevoGrupo('')}>+ Nuevo grupo</button>
          )}
        </>
      )}
      {toast && <div className="nv-toast">{toast}</div>}
    </main>
  )
}

// ── Nuevo grupo (inline) ──
function NuevoGrupoForm({ value, onChange, onSubmit, onCancel, busy }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void; busy: boolean
}) {
  return (
    <form className="nv-add-row nv-link-row" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <input className="nv-input" autoFocus placeholder="Ej. Navidad Caride 2026" value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm" onClick={onCancel}>✕</button>
      <button type="submit" className="nv-btn nv-btn--primary nv-btn--sm" disabled={busy || !value.trim()}>Crear</button>
    </form>
  )
}

// ── Vista de un grupo ──
function GrupoView({ grupo, busy, onBack, onShare, onCopyGroup, onCopyPart, onRename, onDelete, onAddPart, onRenamePart, onDeletePart, onAddDeseo, onEditDeseo, onDeleteDeseo, onRefreshDeseo }: {
  grupo: GrupoDetalle; busy: boolean
  onBack: () => void; onShare: () => void; onCopyGroup: () => void; onCopyPart: (p: Participante) => void
  onRename: () => void; onDelete: () => void
  onAddPart: () => void; onRenamePart: (p: Participante) => void; onDeletePart: (p: Participante) => void
  onAddDeseo: (pid: number) => void; onEditDeseo: (d: Deseo) => void; onDeleteDeseo: (d: Deseo) => void; onRefreshDeseo: (d: Deseo) => void
}) {
  return (
    <>
      <header className="nv-header">
        <div className="nv-topbar">
          <button className="nv-back" onClick={onBack}>‹ Grupos</button>
          <div className="nv-topbar-actions">
            <button className="nv-btn nv-btn--sm" onClick={onCopyGroup}>📋 Copiar</button>
            <button className="nv-btn nv-btn--sm nv-share" onClick={onShare}>🔗 Compartir</button>
          </div>
        </div>
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>{p.nombre}</h2>
              <div className="nv-part-total">{resumen(p.deseos)}</div>
            </div>
            <div className="nv-part-actions">
              <button className="nv-icon-btn" title="Copiar lista" onClick={() => onCopyPart(p)}>📋</button>
              <button className="nv-icon-btn" title="Editar" onClick={() => onRenamePart(p)}>✏️</button>
              <button className="nv-icon-btn" title="Quitar" onClick={() => onDeletePart(p)}>🗑️</button>
            </div>
          </div>

          <div className="nv-deseos">
            {p.deseos.map((d) => (
              <DeseoCard key={d.id} deseo={d} onEdit={() => onEditDeseo(d)} onDelete={() => onDeleteDeseo(d)} onRefresh={() => onRefreshDeseo(d)} />
            ))}
          </div>

          <button className="nv-btn nv-btn--sm nv-add-row" onClick={() => onAddDeseo(p.id)}>+ Deseo</button>
        </section>
      ))}

      <button className="nv-btn nv-btn--block nv-add-row" onClick={onAddPart} disabled={busy}>+ Agregar persona</button>
    </>
  )
}

function DeseoCard({ deseo: d, onEdit, onDelete, onRefresh }: { deseo: Deseo; onEdit: () => void; onDelete: () => void; onRefresh: () => void }) {
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
            {d.link && <button className="nv-icon-btn" title="Actualizar precio/imagen del link" onClick={onRefresh}>🔄</button>}
            <button className="nv-icon-btn" title="Editar" onClick={onEdit}>✏️</button>
            <button className="nv-icon-btn" title="Borrar" onClick={onDelete}>🗑️</button>
          </div>
        </div>
        <div className="nv-deseo-sub">
          <span className={`nv-prio nv-prio--${d.prioridad}`}>{PRIO_LABEL[d.prioridad]}</span>
          {d.link && <a className="nv-deseo-link" href={d.link} target="_blank" rel="noopener noreferrer">↗ {linkHost(d.link)}</a>}
        </div>
        {d.nota && <div className="nv-deseo-nota">{d.nota}</div>}
      </div>
    </div>
  )
}

interface DeseoPatchBody { precio?: number | null; moneda?: Moneda; imagenUrl?: string | null }

function inicial(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase() || '🎁'
}
