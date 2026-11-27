'use client'

import { useMemo, useState } from 'react'
import type { Participante, Deseo, Opcion } from '@/lib/db'
import { fmtMoney, linkHost } from '@/lib/format'
import { IconGift, IconExternal, IconSearch } from '../../icons'

const PRIO_LABEL: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

function inicial(n: string): string {
  return n.trim().charAt(0).toUpperCase() || '🎁'
}
function opcionElegida(d: Deseo): Opcion | null {
  if (!d.opciones.length) return null
  return d.opciones.find((o) => o.id === d.opcionElegidaId) ?? d.opciones[0]
}
const norm = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

// Un deseo matchea si el texto aparece en su título, nota o en cualquiera de
// sus opciones (etiqueta, nota o dominio del link).
function deseoMatches(d: Deseo, q: string): boolean {
  if (norm(d.titulo).includes(q)) return true
  if (d.nota && norm(d.nota).includes(q)) return true
  return d.opciones.some(
    (o) =>
      (o.titulo && norm(o.titulo).includes(q)) ||
      (o.nota && norm(o.nota).includes(q)) ||
      (o.link && norm(linkHost(o.link)).includes(q))
  )
}

// Vista pública de solo lectura con buscador (filtra del lado del cliente lo
// que ya está en pantalla; no edita nada ni necesita login).
export default function PublicList({ participantes }: { participantes: Participante[] }) {
  const [q, setQ] = useState('')
  const filtro = norm(q.trim())

  // Si matchea el nombre de la persona, se muestran todos sus deseos; si no,
  // solo los deseos que matchean. Se ocultan las personas sin resultados.
  const visibles = useMemo(() => {
    if (!filtro) return participantes.map((p) => ({ p, deseos: p.deseos }))
    const out: { p: Participante; deseos: Deseo[] }[] = []
    for (const p of participantes) {
      const nombreOk = norm(p.nombre).includes(filtro)
      const deseos = nombreOk ? p.deseos : p.deseos.filter((d) => deseoMatches(d, filtro))
      if (nombreOk || deseos.length) out.push({ p, deseos })
    }
    return out
  }, [participantes, filtro])

  return (
    <>
      <div className="nv-search">
        <span className="nv-search-ico" aria-hidden><IconSearch size={16} /></span>
        <input
          className="nv-search-input"
          type="search"
          inputMode="search"
          placeholder="Buscar deseo o persona…"
          aria-label="Buscar deseo o persona"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button
            className="nv-search-clear"
            title="Limpiar"
            aria-label="Limpiar búsqueda"
            onClick={() => setQ('')}
          >
            ✕
          </button>
        )}
      </div>

      {participantes.length === 0 && (
        <div className="nv-empty">Todavía no hay nada en esta lista. 🎄</div>
      )}

      {participantes.length > 0 && visibles.length === 0 && (
        <div className="nv-empty">No encontramos nada con “{q.trim()}”.</div>
      )}

      {visibles.map(({ p, deseos }) => (
        <section className="nv-pub-persona" key={p.id}>
          <div className="nv-pub-phead">
            <span className="nv-persona-avatar" aria-hidden>{p.emoji || inicial(p.nombre)}</span>
            <h2 className="nv-pub-pname">{p.nombre}</h2>
          </div>

          {deseos.length === 0 && <div className="nv-dg-empty">Sin deseos todavía.</div>}

          <div className="nv-deseos">
            {deseos.map((d) => {
              const o = opcionElegida(d)
              return (
                <div className="nv-deseo" key={d.id}>
                  {o?.imagenUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img className="nv-deseo-img" src={o.imagenUrl} alt="" loading="lazy" />
                    : <div className="nv-deseo-img nv-deseo-img--ph" aria-hidden><IconGift size={22} /></div>}
                  <div className="nv-deseo-body">
                    <div className="nv-deseo-top">
                      <div className="nv-deseo-title">{d.titulo}</div>
                      {o?.precio != null && <div className="nv-deseo-price">{fmtMoney(o.precio, o.moneda)}</div>}
                    </div>
                    <div className="nv-deseo-sub">
                      <span className={`nv-prio nv-prio--${d.prioridad}`}>{PRIO_LABEL[d.prioridad]}</span>
                      {o?.link && (
                        <a className="nv-deseo-link" href={o.link} target="_blank" rel="noopener noreferrer">
                          <IconExternal size={13} /> {linkHost(o.link)}
                        </a>
                      )}
                      {d.opciones.length > 1 && (
                        <span className="nv-opc-count">{d.opciones.length} opciones</span>
                      )}
                    </div>
                    {d.nota && <div className="nv-deseo-nota">{d.nota}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
