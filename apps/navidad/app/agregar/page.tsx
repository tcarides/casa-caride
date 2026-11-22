'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { DeseoEditor, type DeseoPayload } from '../DeseoEditor'

const BASE = '/navidad'

interface Grupo { id: number; nombre: string }
interface Participante { id: number; nombre: string; emoji: string | null }

/** Del payload compartido (url o un link dentro del texto) saca el link. */
function extractLink(url: string | null, text: string | null): string {
  if (url && /^https?:\/\//i.test(url)) return url
  const m = (text || '').match(/https?:\/\/\S+/)
  return m ? m[0] : (url || '')
}

export default function AgregarPage() {
  const [link, setLink] = useState('')
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [grupoSel, setGrupoSel] = useState<Grupo | null>(null)
  const [participantes, setParticipantes] = useState<Participante[] | null>(null)
  const [partSel, setPartSel] = useState<Participante | null>(null)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setLink(extractLink(q.get('url'), q.get('text')))
    apiFetch('/api/grupos')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setGrupos(d?.grupos ?? []))
      .catch(() => setGrupos([]))
  }, [])

  async function elegirGrupo(g: Grupo) {
    setGrupoSel(g); setParticipantes(null); setPartSel(null)
    const r = await apiFetch(`/api/grupos/${g.id}`)
    if (r.ok) setParticipantes((await r.json()).grupo.participantes as Participante[])
    else setParticipantes([])
  }

  async function nuevoParticipante() {
    if (!grupoSel) return
    const nombre = prompt('Nombre de la persona')?.trim()
    if (!nombre) return
    const r = await apiFetch('/api/participantes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grupoId: grupoSel.id, nombre }) })
    if (r.ok) setPartSel({ id: (await r.json()).id, nombre, emoji: null })
  }

  async function guardar(data: DeseoPayload) {
    const r = await apiFetch('/api/deseos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
    if (r.ok && grupoSel) window.location.assign(`${BASE}?g=${grupoSel.id}`)
    return r.ok
  }

  if (partSel && grupoSel) {
    return (
      <main className="nv">
        <DeseoEditor
          state={{ participanteId: partSel.id, prefillLink: link || undefined, autoPreview: !!link }}
          onClose={() => window.location.assign(`${BASE}?g=${grupoSel.id}`)}
          onSave={guardar}
        />
      </main>
    )
  }

  return (
    <main className="nv">
      <header className="nv-header">
        <div className="nv-title">
          <span className="nv-logo" aria-hidden>🎄</span>
          <div><h1>Agregar deseo</h1><p>{link ? 'desde un link compartido' : 'elegí dónde guardarlo'}</p></div>
        </div>
      </header>

      {link && <div className="nv-shared-link">🔗 {link}</div>}

      {!grupoSel ? (
        <>
          <div className="nv-step">¿A qué grupo?</div>
          {grupos === null ? (
            <div className="nv-loading"><span className="nv-spin" /></div>
          ) : (
            <div className="nv-grupos">
              {grupos.map((g) => (
                <button key={g.id} className="nv-grupo-card" onClick={() => elegirGrupo(g)}>
                  <span className="nv-chev" aria-hidden>›</span><h3><span aria-hidden>🎁</span>{g.nombre}</h3>
                </button>
              ))}
              {grupos.length === 0 && <div className="nv-empty">No hay grupos todavía. Creá uno en la app.</div>}
            </div>
          )}
          <a className="nv-btn nv-btn--block nv-add-row" href={BASE}>‹ Ir a la app</a>
        </>
      ) : (
        <>
          <button className="nv-back" onClick={() => setGrupoSel(null)}>‹ {grupoSel.nombre}</button>
          <div className="nv-step">¿Lista de quién?</div>
          {participantes === null ? (
            <div className="nv-loading"><span className="nv-spin" /></div>
          ) : (
            <div className="nv-grupos">
              {participantes.map((p) => (
                <button key={p.id} className="nv-grupo-card" onClick={() => setPartSel(p)}>
                  <span className="nv-chev" aria-hidden>›</span><h3><span aria-hidden>{p.emoji || '🎁'}</span>{p.nombre}</h3>
                </button>
              ))}
            </div>
          )}
          <button className="nv-btn nv-btn--block nv-add-row" onClick={nuevoParticipante}>+ Nueva persona</button>
        </>
      )}
    </main>
  )
}
