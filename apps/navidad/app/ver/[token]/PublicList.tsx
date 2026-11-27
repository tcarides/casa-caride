'use client'

import { useMemo, useState } from 'react'
import type { Participante, Deseo, Opcion, Moneda } from '@/lib/db'
import { fmtMoney, linkHost } from '@/lib/format'
import { IconGift, IconExternal, IconSearch, IconChevronRight } from '../../icons'

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

// Resumen "N deseos · $total" (totales por la opción principal de cada deseo).
function resumen(deseos: Deseo[]): string {
  const n = deseos.length
  const sums: Partial<Record<Moneda, number>> = {}
  for (const d of deseos) {
    const o = opcionElegida(d)
    if (o && o.precio != null) sums[o.moneda] = (sums[o.moneda] ?? 0) + o.precio
  }
  const base = `${n} ${n === 1 ? 'deseo' : 'deseos'}`
  const totals = (Object.entries(sums) as [Moneda, number][]).map(([m, c]) => fmtMoney(c, m))
  return totals.length ? `${base} · ${totals.join(' · ')}` : base
}

// Tarjeta de deseo (solo lectura). Con `para` muestra para quién es (tab Deseos).
function DeseoCard({ d, para }: { d: Deseo; para?: Participante }) {
  const o = opcionElegida(d)
  return (
    <div className="nv-deseo">
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
          {para && (
            <span className="nv-para">
              <span className="nv-para-av" aria-hidden>{para.emoji || inicial(para.nombre)}</span>
              {para.nombre}
            </span>
          )}
        </div>
        {d.nota && <div className="nv-deseo-nota">{d.nota}</div>}
      </div>
    </div>
  )
}

// Vista pública de solo lectura con tabs (Personas / Deseos) + buscador. Filtra
// del lado del cliente lo que ya está en pantalla; no edita nada ni pide login.
export default function PublicList({ participantes }: { participantes: Participante[] }) {
  const [tab, setTab] = useState<'personas' | 'deseos'>('personas')
  const [q, setQ] = useState('')
  const [abiertas, setAbiertas] = useState<Set<number>>(() => new Set())
  const filtro = norm(q.trim())

  const flat = useMemo(
    () => participantes.flatMap((p) => p.deseos.map((d) => ({ d, p }))),
    [participantes]
  )
  const personasF = useMemo(
    () => (filtro ? participantes.filter((p) => norm(p.nombre).includes(filtro)) : participantes),
    [participantes, filtro]
  )
  const deseosF = useMemo(
    () =>
      filtro
        ? flat.filter(({ d, p }) => norm(p.nombre).includes(filtro) || deseoMatches(d, filtro))
        : flat,
    [flat, filtro]
  )

  function toggle(id: number) {
    setAbiertas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (participantes.length === 0) {
    return <div className="nv-empty">Todavía no hay nada en esta lista. 🎄</div>
  }

  return (
    <>
      <div className="nv-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'personas'}
          className={`nv-tab${tab === 'personas' ? ' nv-tab--on' : ''}`}
          onClick={() => setTab('personas')}
        >
          Personas <span className="nv-tab-n">{participantes.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'deseos'}
          className={`nv-tab${tab === 'deseos' ? ' nv-tab--on' : ''}`}
          onClick={() => setTab('deseos')}
        >
          Deseos <span className="nv-tab-n">{flat.length}</span>
        </button>
      </div>

      <div className="nv-search">
        <span className="nv-search-ico" aria-hidden><IconSearch size={16} /></span>
        <input
          className="nv-search-input"
          type="search"
          inputMode="search"
          placeholder={tab === 'personas' ? 'Buscar persona…' : 'Buscar deseo o persona…'}
          aria-label={tab === 'personas' ? 'Buscar persona' : 'Buscar deseo o persona'}
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

      {tab === 'personas' ? (
        <>
          {filtro && personasF.length === 0 && (
            <div className="nv-empty">Nadie coincide con “{q.trim()}”.</div>
          )}
          <div className="nv-personas">
            {personasF.map((p) => {
              const exp = abiertas.has(p.id)
              return (
                <div className="nv-pub-pacc" key={p.id}>
                  <button
                    className="nv-persona-row"
                    onClick={() => toggle(p.id)}
                    aria-expanded={exp}
                  >
                    <span className="nv-persona-avatar" aria-hidden>{p.emoji || inicial(p.nombre)}</span>
                    <span className="nv-persona-info">
                      <span className="nv-persona-nombre">{p.nombre}</span>
                      <span className="nv-persona-total">{resumen(p.deseos)}</span>
                    </span>
                    <IconChevronRight
                      className="nv-persona-chev"
                      size={18}
                      style={{ transform: exp ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }}
                    />
                  </button>
                  {exp &&
                    (p.deseos.length ? (
                      <div className="nv-deseos nv-pub-pacc-body">
                        {p.deseos.map((d) => <DeseoCard key={d.id} d={d} />)}
                      </div>
                    ) : (
                      <div className="nv-dg-empty">Sin deseos todavía.</div>
                    ))}
                </div>
              )
            })}
          </div>
        </>
      ) : flat.length === 0 ? (
        <div className="nv-empty">Todavía no hay deseos en esta lista. 🎄</div>
      ) : (
        <>
          <div className="nv-deseos-sum">{resumen(flat.map((x) => x.d))}</div>
          {filtro && deseosF.length === 0 && (
            <div className="nv-empty">No encontramos nada con “{q.trim()}”.</div>
          )}
          <div className="nv-deseos">
            {deseosF.map(({ d, p }) => <DeseoCard key={d.id} d={d} para={p} />)}
          </div>
        </>
      )}
    </>
  )
}
