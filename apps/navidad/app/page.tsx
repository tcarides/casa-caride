'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { fmtMoney, linkHost } from '@/lib/format'
import { DeseoEditor, type DeseoEditorState } from './DeseoEditor'
import { OpcionEditor, type OpcionEditorState } from './OpcionForm'
import {
  IconPencil, IconTrash, IconCopy, IconShare, IconRefresh, IconSearch,
  IconPlus, IconChevronLeft, IconChevronRight, IconExternal, IconGift,
} from './icons'

type Moneda = 'ARS' | 'USD'
type Prioridad = 'alta' | 'media' | 'baja'

interface Opcion {
  id: number; deseoId: number; titulo: string | null; link: string | null; imagenUrl: string | null
  precio: number | null; moneda: Moneda; nota: string | null; orden: number
}
interface Deseo {
  id: number; participanteId: number; titulo: string; prioridad: Prioridad; nota: string | null
  createdAt: string; opcionElegidaId: number | null; opciones: Opcion[]
}
interface Participante { id: number; grupoId: number; nombre: string; emoji: string | null; orden: number; deseos: Deseo[] }
interface Grupo { id: number; nombre: string; createdAt: string; nParticipantes?: number; nDeseos?: number }
interface GrupoDetalle extends Grupo { participantes: Participante[] }

const PRIO_LABEL: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }
const PRIO_ORDER: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 }
const BASE = '/navidad'

/** Link compartible de un grupo (para fijar en WhatsApp). */
function grupoUrl(id: number): string {
  if (typeof window === 'undefined') return `${BASE}?g=${id}`
  return `${window.location.origin}${BASE}?g=${id}`
}

// Opción "principal" del deseo: la elegida, o la primera (A) si no hay elegida.
function opcionElegida(d: Deseo): Opcion | null {
  if (!d.opciones.length) return null
  return d.opciones.find((o) => o.id === d.opcionElegidaId) ?? d.opciones[0]
}
// Precio e imagen representativos = los de la opción principal (foto/precio del
// deseo en listados y totales). La imagen cae a cualquier opción con foto.
function precioRep(d: Deseo): { precio: number; moneda: Moneda } | null {
  const o = opcionElegida(d)
  return o && o.precio != null ? { precio: o.precio, moneda: o.moneda } : null
}
function imagenRep(d: Deseo): string | null {
  const o = opcionElegida(d)
  return o?.imagenUrl ?? d.opciones.find((x) => x.imagenUrl)?.imagenUrl ?? null
}

// ── Totales / texto para exportar ──
function resumen(deseos: Deseo[]): string {
  const n = deseos.length
  const sums: Partial<Record<Moneda, number>> = {}
  for (const d of deseos) { const r = precioRep(d); if (r) sums[r.moneda] = (sums[r.moneda] ?? 0) + r.precio }
  const base = `${n} ${n === 1 ? 'deseo' : 'deseos'}`
  const totals = (Object.entries(sums) as [Moneda, number][]).map(([m, c]) => fmtMoney(c, m))
  return totals.length ? `${base} · ${totals.join(' · ')}` : base
}
function lineaOpcion(o: Opcion): string {
  const label = o.titulo || (o.link ? linkHost(o.link) : 'Opción')
  const precio = o.precio != null ? ` — ${fmtMoney(o.precio, o.moneda)}` : ''
  const nota = o.nota ? ` (${o.nota})` : ''
  const link = o.link ? ` — ${o.link}` : ''
  return `   · ${label}${precio}${nota}${link}`
}
function bloqueDeseo(d: Deseo): string {
  const head = `• ${d.titulo}${d.nota ? ` (${d.nota})` : ''}`
  return d.opciones.length ? `${head}\n${d.opciones.map(lineaOpcion).join('\n')}` : head
}
function textoParticipante(grupoNombre: string, p: Participante): string {
  const body = p.deseos.length ? p.deseos.map(bloqueDeseo).join('\n') : '(sin deseos todavía)'
  return `🎄 ${grupoNombre} — ${p.nombre}\n${body}`
}
function textoGrupo(g: GrupoDetalle): string {
  const bloques = g.participantes.map((p) =>
    `${p.emoji ? p.emoji + ' ' : ''}${p.nombre}\n${p.deseos.length ? p.deseos.map(bloqueDeseo).join('\n') : '(sin deseos)'}`)
  return `🎄 ${g.nombre}\n\n${bloques.join('\n\n')}`
}

export default function NavidadPage() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [grupo, setGrupo] = useState<GrupoDetalle | null>(null)
  const [personaId, setPersonaId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [nuevoGrupo, setNuevoGrupo] = useState<string | null>(null)
  const [editorDeseo, setEditorDeseo] = useState<DeseoEditorState | null>(null)
  const [editorOpcion, setEditorOpcion] = useState<OpcionEditorState | null>(null)
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
    setPersonaId(null)
    openGrupo(id)
  }, [openGrupo])

  const volverAGrupos = useCallback(() => {
    history.pushState({}, '', BASE)
    setPersonaId(null)
    setGrupo(null)
  }, [])

  const abrirPersona = useCallback((pid: number) => {
    setPersonaId(pid)
    setGrupo((g) => {
      if (g) history.pushState({}, '', `${BASE}?g=${g.id}&p=${pid}`)
      return g
    })
  }, [])

  const volverAPersonas = useCallback(() => {
    setPersonaId(null)
    setGrupo((g) => {
      if (g) history.pushState({}, '', `${BASE}?g=${g.id}`)
      return g
    })
  }, [])

  useEffect(() => {
    loadGrupos()
    const desdeUrl = () => {
      const sp = new URLSearchParams(window.location.search)
      const g = sp.get('g'); const p = sp.get('p')
      return {
        g: g && /^\d+$/.test(g) ? Number(g) : null,
        p: p && /^\d+$/.test(p) ? Number(p) : null,
      }
    }
    const { g, p } = desdeUrl()
    if (g) { openGrupo(g); setPersonaId(p) }
    const onPop = () => {
      const { g, p } = desdeUrl()
      if (g) { openGrupo(g); setPersonaId(p) } else { setGrupo(null); setPersonaId(null) }
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
    volverAPersonas()
    await reloadGrupo()
  }

  // ── Deseos ──
  // Los editores (DeseoEditor / OpcionEditor) persisten solos; acá sólo
  // cerramos y recargamos.
  const cerrarEditores = useCallback(async () => {
    setEditorDeseo(null); setEditorOpcion(null)
    await reloadGrupo()
  }, [reloadGrupo])

  async function borrarDeseo(d: Deseo) {
    if (!confirm(`¿Borrar "${d.titulo}" y sus opciones?`)) return
    await apiFetch(`/api/deseos/${d.id}`, { method: 'DELETE' })
    await reloadGrupo()
  }

  // ── Opciones ──
  async function borrarOpcion(o: Opcion) {
    if (!confirm('¿Borrar esta opción?')) return
    await apiFetch(`/api/opciones/${o.id}`, { method: 'DELETE' })
    await reloadGrupo()
  }
  // Marca una opción como la "principal" del deseo (la de la foto/precio).
  async function elegirOpcion(d: Deseo, o: Opcion) {
    if (d.opcionElegidaId === o.id) return
    await apiFetch(`/api/deseos/${d.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ opcionElegidaId: o.id }) })
    await reloadGrupo()
  }
  // Refresca precio e imagen de una opción volviendo a leer su link.
  async function refrescarOpcion(o: Opcion) {
    if (!o.link) return
    showToast('Actualizando…')
    try {
      const res = await apiFetch(`/api/preview?url=${encodeURIComponent(o.link)}`)
      const p = (await res.json().catch(() => null))?.preview
      if (!p) { showToast('No pude leer el link'); return }
      const patch: OpcionPatchBody = {}
      if (p.price != null) { patch.precio = p.price; if (p.moneda) patch.moneda = p.moneda }
      if (p.image) patch.imagenUrl = p.image
      if (Object.keys(patch).length === 0) { showToast('Sin cambios'); return }
      await apiFetch(`/api/opciones/${o.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
      await reloadGrupo(); showToast('Actualizado ✓')
    } catch { showToast('No pude actualizar') }
  }

  // ── Render ──
  const persona = grupo && personaId != null
    ? grupo.participantes.find((p) => p.id === personaId) ?? null
    : null

  if (grupo && persona) {
    return (
      <main className="nv">
        <PersonaView
          key={persona.id}
          grupo={grupo} persona={persona} busy={busy}
          onBack={volverAPersonas}
          onCopy={() => copiarTexto(textoParticipante(grupo.nombre, persona), `Lista de ${persona.nombre} copiada ✓`)}
          onRename={() => renombrarParticipante(persona)}
          onDelete={() => borrarParticipante(persona)}
          onAddDeseo={() => setEditorDeseo({ participanteId: persona.id })}
          onEditDeseo={(d) => setEditorDeseo({ participanteId: d.participanteId, deseo: { id: d.id, titulo: d.titulo, prioridad: d.prioridad, nota: d.nota } })}
          onDeleteDeseo={borrarDeseo}
          onAddOpcion={(d) => setEditorOpcion({ deseoId: d.id })}
          onEditOpcion={(o) => setEditorOpcion({ deseoId: o.deseoId, opcion: o })}
          onDeleteOpcion={borrarOpcion}
          onRefreshOpcion={refrescarOpcion}
          onChooseOpcion={elegirOpcion}
        />
        {editorDeseo && (
          <DeseoEditor key={editorDeseo.deseo?.id ?? 'new-deseo'} state={editorDeseo} onClose={() => setEditorDeseo(null)} onSaved={cerrarEditores} />
        )}
        {editorOpcion && (
          <OpcionEditor key={editorOpcion.opcion?.id ?? 'new-opcion'} state={editorOpcion} onClose={() => setEditorOpcion(null)} onSaved={cerrarEditores} />
        )}
        {toast && <div className="nv-toast">{toast}</div>}
      </main>
    )
  }

  if (grupo) {
    return (
      <main className="nv">
        <GrupoView
          key={grupo.id}
          grupo={grupo} busy={busy}
          onBack={volverAGrupos}
          onShare={compartirGrupo}
          onCopyGroup={() => copiarTexto(textoGrupo(grupo), 'Lista copiada ✓')}
          onRename={renombrarGrupo} onDelete={borrarGrupo}
          onAddPart={agregarParticipante}
          onOpenPersona={abrirPersona}
        />
        {toast && <div className="nv-toast">{toast}</div>}
      </main>
    )
  }

  return (
    <main className="nv">
      <header className="nv-header">
        <div className="nv-topbar">
          <a className="nv-back" href="/"><IconChevronLeft size={18} /> Casa Caride</a>
        </div>
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
                <IconChevronRight className="nv-chev" size={20} />
                <h3><span className="nv-grupo-ico" aria-hidden><IconGift size={17} /></span>{g.nombre}</h3>
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

// ── Nivel 2: personas del grupo (con buscador) ──
function GrupoView({ grupo, busy, onBack, onShare, onCopyGroup, onRename, onDelete, onAddPart, onOpenPersona }: {
  grupo: GrupoDetalle; busy: boolean
  onBack: () => void; onShare: () => void; onCopyGroup: () => void
  onRename: () => void; onDelete: () => void
  onAddPart: () => void; onOpenPersona: (pid: number) => void
}) {
  const [tab, setTab] = useState<'personas' | 'deseos'>('personas')
  const [q, setQ] = useState('')
  const filtro = q.trim()
  const hayPersonas = grupo.participantes.length > 0

  const personas = filtro
    ? grupo.participantes.filter((p) => norm(p.nombre).includes(norm(filtro)))
    : grupo.participantes

  // Listado plano de todos los deseos del grupo (con quién lo pidió), ordenado
  // por prioridad y después por persona.
  const deseos = grupo.participantes
    .flatMap((p) => p.deseos.map((d) => ({ d, p })))
    .sort((a, b) =>
      (PRIO_ORDER[a.d.prioridad] - PRIO_ORDER[b.d.prioridad]) ||
      a.p.nombre.localeCompare(b.p.nombre) ||
      a.d.titulo.localeCompare(b.d.titulo))
  const deseosFiltrados = filtro
    ? deseos.filter(({ d, p }) => norm(d.titulo).includes(norm(filtro)) || norm(p.nombre).includes(norm(filtro)))
    : deseos

  return (
    <>
      <header className="nv-header">
        <div className="nv-topbar">
          <button className="nv-back" onClick={onBack}><IconChevronLeft size={18} /> Grupos</button>
          <div className="nv-topbar-actions">
            <button className="nv-btn nv-btn--sm" onClick={onCopyGroup}><IconCopy size={15} /> Copiar</button>
            <button className="nv-btn nv-btn--sm nv-share" onClick={onShare}><IconShare size={15} /> Compartir</button>
          </div>
        </div>
        <div className="nv-title">
          <span className="nv-logo" aria-hidden><IconGift size={22} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{grupo.nombre}</h1>
            <p>{grupo.participantes.length} {grupo.participantes.length === 1 ? 'persona' : 'personas'}</p>
          </div>
          <button className="nv-icon-btn" title="Renombrar grupo" onClick={onRename}><IconPencil /></button>
          <button className="nv-icon-btn nv-icon-btn--danger" title="Borrar grupo" onClick={onDelete}><IconTrash /></button>
        </div>
      </header>

      {!hayPersonas ? (
        <div className="nv-empty">Sumá a las personas del grupo para armar sus listas.</div>
      ) : (
        <>
          <div className="nv-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'personas'} className={`nv-tab${tab === 'personas' ? ' nv-tab--on' : ''}`} onClick={() => setTab('personas')}>
              Personas <span className="nv-tab-n">{grupo.participantes.length}</span>
            </button>
            <button role="tab" aria-selected={tab === 'deseos'} className={`nv-tab${tab === 'deseos' ? ' nv-tab--on' : ''}`} onClick={() => setTab('deseos')}>
              Deseos <span className="nv-tab-n">{deseos.length}</span>
            </button>
          </div>

          <div className="nv-search">
            <span className="nv-search-ico" aria-hidden><IconSearch size={16} /></span>
            <input
              className="nv-search-input"
              type="search"
              inputMode="search"
              placeholder={tab === 'personas' ? 'Buscar persona…' : 'Buscar deseo o persona…'}
              aria-label={tab === 'personas' ? 'Buscar persona' : 'Buscar deseo'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {filtro && (
              <button className="nv-search-clear" title="Limpiar" aria-label="Limpiar búsqueda" onClick={() => setQ('')}>✕</button>
            )}
          </div>

          {tab === 'personas' ? (
            <>
              {filtro && personas.length === 0 && (
                <div className="nv-empty">Nadie coincide con “{q}”.</div>
              )}
              <div className="nv-personas">
                {personas.map((p) => (
                  <button className="nv-persona-row" key={p.id} onClick={() => onOpenPersona(p.id)}>
                    <span className="nv-persona-avatar" aria-hidden>{p.emoji || inicial(p.nombre)}</span>
                    <span className="nv-persona-info">
                      <span className="nv-persona-nombre">{p.nombre}</span>
                      <span className="nv-persona-total">{resumen(p.deseos)}</span>
                    </span>
                    <IconChevronRight className="nv-persona-chev" size={18} />
                  </button>
                ))}
              </div>
            </>
          ) : deseos.length === 0 ? (
            <div className="nv-empty">Todavía no hay deseos en este grupo.<br />Entrá a una persona para cargar el primero.</div>
          ) : (
            <>
              <div className="nv-deseos-sum">{resumen(deseos.map((x) => x.d))}</div>
              {filtro && deseosFiltrados.length === 0 && (
                <div className="nv-empty">Ningún deseo coincide con “{q}”.</div>
              )}
              <div className="nv-deseos">
                {deseosFiltrados.map(({ d, p }) => (
                  <DeseoFlatCard key={d.id} deseo={d} persona={p} onOpen={() => onOpenPersona(p.id)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'personas' && (
        <button className="nv-btn nv-btn--block nv-add-row" onClick={onAddPart} disabled={busy}>
          <IconPlus size={16} /> Agregar persona
        </button>
      )}
    </>
  )
}

// Fila de deseo en la tab "Deseos" (listado plano del grupo): muestra el ítem
// y para quién es; al tocar lleva a la pantalla de esa persona (para editar).
function DeseoFlatCard({ deseo: d, persona: p, onOpen }: { deseo: Deseo; persona: Participante; onOpen: () => void }) {
  const rep = precioRep(d)
  const img = imagenRep(d)
  const n = d.opciones.length
  return (
    <button className="nv-deseo nv-deseo--flat" onClick={onOpen}>
      {img
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="nv-deseo-img" src={img} alt="" loading="lazy" />
        : <div className="nv-deseo-img nv-deseo-img--ph" aria-hidden><IconGift size={22} /></div>}
      <div className="nv-deseo-body">
        <div className="nv-deseo-top">
          <div className="nv-deseo-title">{d.titulo}</div>
          {rep && <div className="nv-deseo-price">{fmtMoney(rep.precio, rep.moneda)}</div>}
        </div>
        <div className="nv-deseo-sub">
          <span className={`nv-prio nv-prio--${d.prioridad}`}>{PRIO_LABEL[d.prioridad]}</span>
          {n > 0 && <span className="nv-opc-count">{n} {n === 1 ? 'opción' : 'opciones'}</span>}
          <span className="nv-para">
            <span className="nv-para-av" aria-hidden>{p.emoji || inicial(p.nombre)}</span>
            {p.nombre}
          </span>
        </div>
      </div>
      <IconChevronRight className="nv-persona-chev" size={18} />
    </button>
  )
}

// ── Nivel 3: deseos de una persona (ver + editar, con opciones) ──
function PersonaView({ grupo, persona: p, busy, onBack, onCopy, onRename, onDelete, onAddDeseo, onEditDeseo, onDeleteDeseo, onAddOpcion, onEditOpcion, onDeleteOpcion, onRefreshOpcion, onChooseOpcion }: {
  grupo: GrupoDetalle; persona: Participante; busy: boolean
  onBack: () => void; onCopy: () => void; onRename: () => void; onDelete: () => void
  onAddDeseo: () => void; onEditDeseo: (d: Deseo) => void; onDeleteDeseo: (d: Deseo) => void
  onAddOpcion: (d: Deseo) => void; onEditOpcion: (o: Opcion) => void; onDeleteOpcion: (o: Opcion) => void; onRefreshOpcion: (o: Opcion) => void
  onChooseOpcion: (d: Deseo, o: Opcion) => void
}) {
  return (
    <>
      <header className="nv-header">
        <div className="nv-topbar">
          <button className="nv-back" onClick={onBack}><IconChevronLeft size={18} /> {grupo.nombre}</button>
          <div className="nv-topbar-actions">
            <button className="nv-btn nv-btn--sm" onClick={onCopy}><IconCopy size={15} /> Copiar</button>
          </div>
        </div>
        <div className="nv-title">
          <span className="nv-persona-avatar nv-persona-avatar--lg" aria-hidden>{p.emoji || inicial(p.nombre)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{p.nombre}</h1>
            <p>{resumen(p.deseos)}</p>
          </div>
          <button className="nv-icon-btn" title="Renombrar" onClick={onRename}><IconPencil /></button>
          <button className="nv-icon-btn nv-icon-btn--danger" title="Quitar persona" onClick={onDelete}><IconTrash /></button>
        </div>
      </header>

      {p.deseos.length === 0 && (
        <div className="nv-empty">Todavía no hay deseos.<br />Agregá el primero con el botón de abajo.</div>
      )}

      <div className="nv-deseos-list">
        {p.deseos.map((d) => (
          <DeseoCard
            key={d.id} deseo={d}
            onEdit={() => onEditDeseo(d)} onDelete={() => onDeleteDeseo(d)}
            onAddOpcion={() => onAddOpcion(d)}
            onEditOpcion={onEditOpcion} onDeleteOpcion={onDeleteOpcion} onRefreshOpcion={onRefreshOpcion}
            onChooseOpcion={(o) => onChooseOpcion(d, o)}
          />
        ))}
      </div>

      <button className="nv-btn nv-btn--primary nv-btn--block nv-add-row" onClick={onAddDeseo} disabled={busy}>
        <IconPlus size={16} /> Agregar deseo
      </button>
    </>
  )
}

// Un deseo (concepto) con su cabecera y la lista de opciones (alternativas).
function DeseoCard({ deseo: d, onEdit, onDelete, onAddOpcion, onEditOpcion, onDeleteOpcion, onRefreshOpcion, onChooseOpcion }: {
  deseo: Deseo
  onEdit: () => void; onDelete: () => void; onAddOpcion: () => void
  onEditOpcion: (o: Opcion) => void; onDeleteOpcion: (o: Opcion) => void; onRefreshOpcion: (o: Opcion) => void
  onChooseOpcion: (o: Opcion) => void
}) {
  const elegida = opcionElegida(d)
  const varias = d.opciones.length > 1
  return (
    <div className="nv-dg">
      <div className="nv-dg-head">
        <div className="nv-dg-titlewrap">
          <span className={`nv-prio nv-prio--${d.prioridad}`}>{PRIO_LABEL[d.prioridad]}</span>
          <h3 className="nv-dg-title">{d.titulo}</h3>
        </div>
        <div className="nv-dg-actions">
          <button className="nv-icon-btn" title="Editar deseo" onClick={onEdit}><IconPencil size={16} /></button>
          <button className="nv-icon-btn nv-icon-btn--danger" title="Borrar deseo" onClick={onDelete}><IconTrash size={16} /></button>
        </div>
      </div>
      {d.nota && <div className="nv-dg-nota">{d.nota}</div>}

      <div className="nv-opciones">
        {d.opciones.map((o, i) => (
          <OpcionRow
            key={o.id} opcion={o}
            letra={String.fromCharCode(65 + i)}
            principal={elegida?.id === o.id}
            seleccionable={varias}
            onChoose={() => onChooseOpcion(o)}
            onEdit={() => onEditOpcion(o)} onDelete={() => onDeleteOpcion(o)} onRefresh={() => onRefreshOpcion(o)}
          />
        ))}
        {d.opciones.length === 0 && <div className="nv-dg-empty">Sin opciones todavía.</div>}
      </div>

      <button className="nv-btn nv-btn--sm nv-dg-add" onClick={onAddOpcion}><IconPlus size={15} /> Opción</button>
    </div>
  )
}

// Una opción (alternativa) dentro de un deseo. Con varias opciones muestra su
// letra (A, B, C…) como selector de la opción principal (la de la foto/precio).
function OpcionRow({ opcion: o, letra, principal, seleccionable, onChoose, onEdit, onDelete, onRefresh }: {
  opcion: Opcion; letra: string; principal: boolean; seleccionable: boolean
  onChoose: () => void; onEdit: () => void; onDelete: () => void; onRefresh: () => void
}) {
  return (
    <div className={`nv-deseo nv-opcion${seleccionable && principal ? ' nv-opcion--on' : ''}`}>
      {seleccionable && (
        <button
          className="nv-opcion-pick" onClick={onChoose} aria-pressed={principal}
          title={principal ? 'Opción principal (la de la foto/precio)' : 'Elegir como opción principal'}
        >
          {letra}
        </button>
      )}
      {o.imagenUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="nv-deseo-img" src={o.imagenUrl} alt="" loading="lazy" />
        : <div className="nv-deseo-img nv-deseo-img--ph" aria-hidden><IconGift size={22} /></div>}
      <div className="nv-deseo-body">
        <div className="nv-deseo-top">
          <div className="nv-deseo-title">{o.titulo || (o.link ? linkHost(o.link) : 'Opción')}</div>
          {o.precio != null && <div className="nv-deseo-price">{fmtMoney(o.precio, o.moneda)}</div>}
          <div className="nv-deseo-actions">
            {o.link && <button className="nv-icon-btn" title="Actualizar precio/imagen del link" onClick={onRefresh}><IconRefresh size={16} /></button>}
            <button className="nv-icon-btn" title="Editar opción" onClick={onEdit}><IconPencil size={16} /></button>
            <button className="nv-icon-btn nv-icon-btn--danger" title="Borrar opción" onClick={onDelete}><IconTrash size={16} /></button>
          </div>
        </div>
        <div className="nv-deseo-sub">
          {seleccionable && principal && <span className="nv-opcion-badge">Principal</span>}
          {o.link && <a className="nv-deseo-link" href={o.link} target="_blank" rel="noopener noreferrer"><IconExternal size={13} /> {linkHost(o.link)}</a>}
          {o.nota && <span className="nv-deseo-optnota">{o.nota}</span>}
        </div>
      </div>
    </div>
  )
}

interface OpcionPatchBody { precio?: number | null; moneda?: Moneda; imagenUrl?: string | null }

function inicial(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase() || '🎁'
}

// Normaliza para buscar sin importar acentos ni mayúsculas (José ≈ jose).
function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
