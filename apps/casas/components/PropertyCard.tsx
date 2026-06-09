'use client'

import { useRef, useState } from 'react'
import {
  Eye, HelpCircle, Heart, X, MoreHorizontal, ExternalLink,
  StickyNote, EyeOff, RotateCcw, Maximize2, BedDouble, Bath, Car, MapPin,
} from 'lucide-react'
import type { Property, PropertyStatus, UserId } from '@/lib/types'
import { USER_LABELS } from '@/lib/types'

const SOURCE_META: Record<string, { label: string; cls: string }> = {
  zonaprop:     { label: 'ZonaProp',     cls: 'bg-yellow-400 text-slate-900' },
  argenprob:    { label: 'ArgenProp',    cls: 'bg-orange-500 text-white' },
  mercadolibre: { label: 'MercadoLibre', cls: 'bg-yellow-300 text-slate-900' },
}

interface StatusMeta {
  label: string
  accent: string   // color del acento (cinta + badge)
  badge: string    // clases del badge per-usuario
}

const STATUS_META: Record<PropertyStatus, StatusMeta> = {
  unseen:    { label: 'Sin ver',    accent: 'transparent', badge: 'bg-slate-600' },
  seen:      { label: 'Vista',      accent: '#3b82f6',     badge: 'bg-blue-600' },
  maybe:     { label: 'Quizás',     accent: '#a855f7',     badge: 'bg-purple-600' },
  favorite:  { label: 'Favorita',   accent: '#f59e0b',     badge: 'bg-amber-500' },
  discarded: { label: 'Descartada', accent: '#ef4444',     badge: 'bg-red-600' },
}

const USER_INITIAL: Record<UserId, string> = { tomi: 'T', flori: 'F' }

const SEGMENTS: { s: PropertyStatus; Icon: typeof Eye; on: string; label: string }[] = [
  { s: 'seen',      Icon: Eye,        on: 'bg-blue-600 text-white',   label: 'Vista' },
  { s: 'maybe',     Icon: HelpCircle, on: 'bg-purple-600 text-white', label: 'Quizás' },
  { s: 'favorite',  Icon: Heart,      on: 'bg-amber-500 text-white',  label: 'Favorita' },
  { s: 'discarded', Icon: X,          on: 'bg-red-600 text-white',    label: 'Descartar' },
]

function fmt(n?: number) {
  if (!n) return '-'
  return n.toLocaleString('es-AR')
}

interface Props {
  property: Property
  currentUser: UserId
  compact?: boolean
  rankScore?: number
  onStatusChange: (id: string, status: PropertyStatus) => Promise<void>
  onNotesChange: (id: string, notes: string) => Promise<void>
  onDiscontinuedChange: (id: string, discontinued: boolean) => Promise<void>
  onOpenPhotos?: (p: Property) => void
}

export default function PropertyCard({
  property: p, currentUser, compact = false, rankScore,
  onStatusChange, onNotesChange, onDiscontinuedChange, onOpenPhotos,
}: Props) {
  const [notes, setNotes] = useState(p.notes ?? '')
  const [showNotes, setShowNotes] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragX, setDragX] = useState(0)
  const dragStart = useRef<number | null>(null)

  const myStatus: PropertyStatus = p.userStatus[currentUser] ?? 'unseen'
  const otherUser: UserId = currentUser === 'tomi' ? 'flori' : 'tomi'
  const otherStatus: PropertyStatus = p.userStatus[otherUser] ?? 'unseen'
  const isDiscontinued = !!p.discontinuedAt
  const accent = STATUS_META[myStatus].accent

  async function changeStatus(s: PropertyStatus) {
    const next = myStatus === s ? 'seen' : s
    setSaving(true)
    await onStatusChange(p.id, next)
    setSaving(false)
  }

  async function saveNotes() {
    setSaving(true)
    await onNotesChange(p.id, notes)
    setSaving(false)
    setShowNotes(false)
  }

  async function toggleDiscontinued() {
    setMenuOpen(false)
    setSaving(true)
    await onDiscontinuedChange(p.id, !isDiscontinued)
    setSaving(false)
  }

  function openPhotos() {
    if (onOpenPhotos && p.photos.length > 0) onOpenPhotos(p)
    else window.open(p.url, '_blank')
  }

  // ── Swipe (sólo touch): izquierda = descartar, derecha = favorita ──
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== 'touch') return
    dragStart.current = e.clientX
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStart.current === null) return
    setDragX(e.clientX - dragStart.current)
  }
  function onPointerUp() {
    if (dragStart.current === null) return
    const dx = dragX
    dragStart.current = null
    setDragX(0)
    if (dx > 90) changeStatus('favorite')
    else if (dx < -90) changeStatus('discarded')
  }

  const photo = p.photos[0]
  const priceStr = p.price
    ? `${p.currency === 'USD' ? 'USD' : '$'} ${fmt(p.price)}`
    : 'Sin precio'

  const renderUserBadge = (user: UserId) => {
    const status: PropertyStatus = p.userStatus[user] ?? 'unseen'
    if (status === 'unseen') return null
    const m = STATUS_META[status]
    return (
      <span
        key={user}
        className={`${m.badge} text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none flex items-center gap-0.5 shadow`}
        title={`${USER_LABELS[user]}: ${m.label}`}
      >
        {USER_INITIAL[user]}
      </span>
    )
  }

  const src = SOURCE_META[p.source] ?? { label: p.source, cls: 'bg-slate-700 text-white' }

  // ─── Vista compacta ────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div
        className={`group flex flex-col rounded-xl overflow-hidden border bg-surface transition-all relative
          ${isDiscontinued ? 'opacity-50 border-red-900/60' : myStatus === 'discarded' ? 'opacity-50 border-slate-700' : 'border-slate-700 hover:border-slate-500'}`}
        style={{ borderTop: accent !== 'transparent' ? `3px solid ${accent}` : undefined }}
      >
        <div className="relative h-28 bg-slate-700 cursor-pointer flex-shrink-0 overflow-hidden" onClick={openPhotos}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={p.title} loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-xs">Sin foto</div>
          )}
          <span className={`absolute top-1 left-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${src.cls}`}>{src.label}</span>
          <div className="absolute top-1 right-1 flex gap-0.5">{renderUserBadge('tomi')}{renderUserBadge('flori')}</div>
          {rankScore != null && (
            <span className="absolute bottom-1 left-1 z-10 text-[10px] font-black bg-accent-500 text-accent-fg px-1.5 py-0.5 rounded-full shadow leading-none">
              {rankScore}
            </span>
          )}
          {isDiscontinued && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-red-900/80 text-red-100 text-center text-[10px] font-bold py-0.5 uppercase tracking-wider">No publicada</div>
          )}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
            <span className="text-white font-bold text-sm">{priceStr}</span>
          </div>
        </div>
        <div className="p-2 flex flex-col gap-1 flex-1">
          <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.address}
            className="block text-[11px] text-slate-300 hover:text-accent-400 transition-colors leading-tight line-clamp-2">
            {p.address || p.neighborhood || 'Sin dirección'}
          </a>
          <div className="flex gap-2 text-[10px] text-slate-400 flex-wrap items-center">
            {p.rooms ? <span className="inline-flex items-center gap-0.5"><BedDouble size={11} className="text-accent-400" />{p.rooms}</span> : null}
            {p.bathrooms ? <span className="inline-flex items-center gap-0.5"><Bath size={11} className="text-accent-400" />{p.bathrooms}</span> : null}
            {(p.m2Covered || p.m2Total) ? <span className="inline-flex items-center gap-0.5"><Maximize2 size={11} className="text-accent-400" />{p.m2Covered ?? p.m2Total} m²</span> : null}
          </div>
          <div className="flex gap-0.5 mt-auto pt-0.5">
            {SEGMENTS.map(({ s, Icon, on }) => (
              <button key={s} onClick={() => changeStatus(s)}
                className={`flex-1 flex items-center justify-center py-1 rounded transition-colors ${myStatus === s ? on : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                title={STATUS_META[s].label} aria-label={STATUS_META[s].label}>
                <Icon size={13} />
              </button>
            ))}
          </div>
          {saving && <div className="text-[10px] text-slate-500 text-center">Guardando…</div>}
        </div>
      </div>
    )
  }

  // ─── Vista cómoda ──────────────────────────────────────────────────────────
  return (
    <div
      className={`group flex flex-col rounded-2xl overflow-hidden border bg-surface shadow-card transition-all relative
        ${isDiscontinued ? 'opacity-60 border-red-900/60' : myStatus === 'discarded' ? 'opacity-60 border-slate-700' : 'border-slate-700/80 hover:border-slate-500'}`}
      style={{
        borderTop: accent !== 'transparent' ? `3px solid ${accent}` : undefined,
        transform: dragX ? `translateX(${dragX}px) rotate(${dragX * 0.02}deg)` : undefined,
        transition: dragX ? 'none' : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Indicadores de swipe */}
      {dragX > 30 && (
        <div className="absolute top-3 left-3 z-20 bg-amber-500 text-white rounded-full p-2 shadow-lg"><Heart size={18} /></div>
      )}
      {dragX < -30 && (
        <div className="absolute top-3 right-3 z-20 bg-red-600 text-white rounded-full p-2 shadow-lg"><X size={18} /></div>
      )}

      {/* Foto */}
      <div className="relative h-48 bg-slate-700 cursor-pointer flex-shrink-0 overflow-hidden" onClick={openPhotos}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={p.title} loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">Sin foto</div>
        )}

        <span className={`absolute top-2.5 left-2.5 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow ${src.cls}`}>
          {src.label}
        </span>

        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          {renderUserBadge('tomi')}
          {renderUserBadge('flori')}
          <button
            onClick={(e) => { e.stopPropagation(); changeStatus('favorite') }}
            className={`rounded-full p-1.5 shadow transition-colors ${myStatus === 'favorite' ? 'bg-amber-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'}`}
            title="Marcar favorita" aria-label="Marcar favorita"
          >
            <Heart size={16} fill={myStatus === 'favorite' ? 'currentColor' : 'none'} />
          </button>
        </div>

        {p.photos.length > 1 && (
          <span className="absolute bottom-2.5 right-2.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">
            {p.photos.length} fotos
          </span>
        )}
        {rankScore != null && (
          <span className="absolute bottom-2.5 left-2.5 z-10 text-[12px] font-black bg-accent-500 text-accent-fg px-2 py-0.5 rounded-full shadow leading-none">
            {rankScore}
          </span>
        )}

        {isDiscontinued && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-red-900/80 text-red-100 text-center text-sm font-bold py-1 uppercase tracking-wider">
            No publicada
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent px-3.5 pt-8 pb-2.5">
          <span className="text-white font-extrabold text-xl tracking-tight">{priceStr}</span>
          {p.expenses ? <span className="text-slate-300 text-xs ml-2">+ ${fmt(p.expenses)} exp.</span> : null}
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col gap-2.5 flex-1">
        <div>
          <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.title}
            className="block text-sm font-semibold text-slate-100 hover:text-accent-400 transition-colors truncate">
            {p.title || p.address || 'Sin título'}
          </a>
          <div className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5" title={p.address}>
            <MapPin size={12} className="text-slate-500 flex-shrink-0" />
            {[p.neighborhood, p.address].filter(Boolean).join(' · ') || 'Sin dirección'}
          </div>
        </div>

        <div className="flex gap-3.5 text-xs text-slate-300 flex-wrap items-center">
          {(p.m2Total || p.m2Covered) ? (
            <span className="inline-flex items-center gap-1"><Maximize2 size={14} className="text-accent-400" />{p.m2Total ?? p.m2Covered} m²</span>
          ) : null}
          {p.rooms ? <span className="inline-flex items-center gap-1"><BedDouble size={14} className="text-accent-400" />{p.rooms} amb</span> : null}
          {p.bathrooms ? <span className="inline-flex items-center gap-1"><Bath size={14} className="text-accent-400" />{p.bathrooms}</span> : null}
          {p.garages ? <span className="inline-flex items-center gap-1"><Car size={14} className="text-accent-400" />{p.garages}</span> : null}
          {p.pricePerM2 ? <span className="text-slate-400" title="Precio por m²">USD {fmt(p.pricePerM2)}/m²</span> : null}
          {typeof p.daysOnMarket === 'number' ? <span className="text-slate-500" title="Días desde que apareció">{p.daysOnMarket}d</span> : null}
        </div>

        {p.groupSiblings && p.groupSiblings.length > 0 && (
          <div className="flex flex-wrap gap-1 text-[10px] items-center">
            <span className="text-slate-500" title="Esta es la publicación más barata del grupo">También en:</span>
            {p.groupSiblings.map(s => {
              const best = s.id === p.groupBestInfoId
              return (
                <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  title={best ? 'La publicación con más información' : undefined}
                  className={`px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 transition-colors ${best ? 'bg-accent-600 hover:bg-accent-500 text-accent-fg font-semibold' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
                  {(SOURCE_META[s.source]?.label) ?? s.source}{best ? ' · + info' : ''}<ExternalLink size={9} />
                </a>
              )
            })}
            {/* Si la publicación más completa es ESTA (la primary/más barata) */}
            {p.groupBestInfoId === p.id && (
              <span className="text-accent-400 font-semibold" title="Esta publicación es la más completa y la más barata">· esta: + info</span>
            )}
          </div>
        )}

        {p.notes && !showNotes && (
          <div className="text-xs text-amber-300/90 italic line-clamp-2 bg-amber-950/20 rounded-md px-2 py-1" title={p.notes}>
            {p.notesAuthor && <span className="not-italic font-semibold mr-1">{USER_LABELS[p.notesAuthor]}:</span>}
            {p.notes}
          </div>
        )}

        {showNotes && (
          <div className="flex gap-1">
            <textarea
              className="flex-1 text-xs bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-slate-200 resize-none focus:border-accent outline-none"
              rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notas (compartidas)…" autoFocus
            />
            <button onClick={saveNotes} className="text-xs bg-accent-600 hover:bg-accent-500 text-accent-fg px-3 rounded-md font-medium">OK</button>
          </div>
        )}

        {/* Acciones: control segmentado + menú */}
        <div className="flex gap-1.5 mt-auto pt-0.5 items-stretch">
          <div className="flex gap-1 flex-1 bg-slate-900/60 rounded-lg p-1">
            {SEGMENTS.map(({ s, Icon, on, label }) => (
              <button key={s} onClick={() => changeStatus(s)}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-colors ${myStatus === s ? on : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'}`}
                title={label} aria-label={label}>
                <Icon size={16} fill={s === 'favorite' && myStatus === s ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>

          <div className="relative">
            <button onClick={() => setMenuOpen(v => !v)}
              className="h-full px-2 rounded-lg bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
              title="Más acciones" aria-label="Más acciones">
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute bottom-full right-0 mb-1 z-40 w-44 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden animate-fade-in">
                  <button onClick={() => { setShowNotes(v => !v); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 text-left">
                    <StickyNote size={14} /> {p.notes ? 'Editar nota' : 'Agregar nota'}
                  </button>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 text-left">
                    <ExternalLink size={14} /> Abrir aviso
                  </a>
                  <button onClick={toggleDiscontinued}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 text-left">
                    {isDiscontinued ? <><RotateCcw size={14} /> Volver a publicada</> : <><EyeOff size={14} /> Marcar no publicada</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {otherStatus !== 'unseen' && (
          <div className="text-[10px] text-slate-500 -mt-1">
            {USER_LABELS[otherUser]} la marcó {STATUS_META[otherStatus].label.toLowerCase()}
          </div>
        )}
      </div>
    </div>
  )
}
