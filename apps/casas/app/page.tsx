'use client'
import { apiFetch } from '@/lib/api'

import { useEffect, useMemo, useState, useCallback, useDeferredValue, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Map as MapIcon, Link2, RefreshCw, LayoutGrid, Rows3, ArrowUpDown,
  SlidersHorizontal, X, Repeat, List, Loader2, Archive, Sparkles,
} from 'lucide-react'
import PropertyCard from '@/components/PropertyCard'
import CardSkeleton from '@/components/CardSkeleton'
import PhotoModal from '@/components/PhotoModal'
import FiltersPanel from '@/components/Filters'
import UserSelector from '@/components/UserSelector'
import StatsBar from '@/components/StatsBar'
import type { Property, Filters, PropertyStatus, UserId } from '@/lib/types'
import { USER_LABELS } from '@/lib/types'

const DEFAULT_FILTERS: Filters = {
  zona: [], tipo: [], source: [], status: [],
  favBoth: false, discontinued: 'show', hideDuplicates: true,
  priceMin: '', priceMax: '', m2Min: '', m2Max: '', roomsMin: '', search: '',
}

type SortKey = 'recommended' | 'newest' | 'price_asc' | 'price_desc' | 'm2_asc' | 'm2_desc'

// Rango de precio "ideal" que se prioriza en el orden Recomendado (USD)
const SWEET_MIN = 300_000
const SWEET_MAX = 500_000

const TIPO_LABELS: Record<string, string> = { casa: 'Casa', ph: 'PH' }
const SOURCE_LABELS: Record<string, string> = { zonaprop: 'ZonaProp', argenprob: 'ArgenProp', mercadolibre: 'MercadoLibre' }
const STATUS_LABELS: Record<PropertyStatus, string> = {
  unseen: 'Sin ver', seen: 'Vista', maybe: 'Quizás', favorite: 'Favorita', discarded: 'Descartada',
}

// Normaliza para comparar sin acentos ni mayúsculas (Martínez ≡ Martinez, Béccar ≡ Beccar)
function normZona(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function matchesZona(p: Property, zona: string): boolean {
  const z = normZona(zona)
  const hay = normZona(`${p.address ?? ''} ${p.neighborhood ?? ''} ${p.title ?? ''} ${p.url}`)
  return hay.includes(z) || hay.includes(z.replace(/ /g, '-'))
}

function getPropertyType(p: Property): string {
  if (p.propertyType) return p.propertyType
  const url = p.url.toLowerCase()
  if (url.includes('/ph/') || url.includes('ph-venta') || url.includes('-ph-') || url.includes('_ph_')) return 'ph'
  return 'casa'
}

function getMyStatus(p: Property, user: UserId): PropertyStatus {
  return p.userStatus[user] ?? 'unseen'
}

function applyFilters(properties: Property[], f: Filters, user: UserId, includeStatus = true): Property[] {
  return properties.filter(p => {
    const isDiscontinued = !!p.discontinuedAt
    if (f.discontinued === 'hide' && isDiscontinued) return false
    if (f.discontinued === 'only' && !isDiscontinued) return false
    if (f.hideDuplicates && p.groupId && p.isGroupPrimary === false) return false
    if (f.zona.length > 0 && !f.zona.some(z => matchesZona(p, z))) return false
    if (f.tipo.length > 0 && !f.tipo.includes(getPropertyType(p))) return false
    if (f.source.length > 0 && !f.source.includes(p.source)) return false
    if (includeStatus && f.status.length > 0 && !f.status.includes(getMyStatus(p, user))) return false
    if (f.favBoth && (p.userStatus.tomi !== 'favorite' || p.userStatus.flori !== 'favorite')) return false
    if (f.priceMin && (p.price ?? 0) < Number(f.priceMin)) return false
    if (f.priceMax && p.price !== undefined && p.price > Number(f.priceMax)) return false
    if (f.m2Min && (p.m2Total ?? 0) < Number(f.m2Min)) return false
    if (f.m2Max && p.m2Total !== undefined && p.m2Total > Number(f.m2Max)) return false
    if (f.roomsMin && (p.rooms ?? 0) < Number(f.roomsMin)) return false
    if (f.search) {
      const q = f.search.toLowerCase()
      const hay = `${p.address} ${p.neighborhood} ${p.title}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

// Las "sin ver" van primero; las descartadas, al fondo de todo.
function statusRank(p: Property, user: UserId): number {
  const st = p.userStatus[user] ?? 'unseen'
  if (st === 'unseen') return 0
  if (st === 'discarded') return 2
  return 1
}

// 0 si está en el rango ideal de precio, 1 si no.
function sweetSpotRank(p: Property): number {
  const price = p.price ?? 0
  return price >= SWEET_MIN && price <= SWEET_MAX ? 0 : 1
}

function applySort(properties: Property[], sort: SortKey, user: UserId): Property[] {
  const arr = [...properties]
  // Criterio secundario según el sort elegido
  const secondary: (a: Property, b: Property) => number = (() => {
    switch (sort) {
      case 'price_asc': return (a, b) => (a.price ?? 0) - (b.price ?? 0)
      case 'price_desc': return (a, b) => (b.price ?? 0) - (a.price ?? 0)
      case 'm2_asc': return (a, b) => (a.m2Total ?? 0) - (b.m2Total ?? 0)
      case 'm2_desc': return (a, b) => (b.m2Total ?? 0) - (a.m2Total ?? 0)
      case 'newest': return (a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt)
      case 'recommended':
      default:
        // Rango ideal de precio primero, luego más nuevas
        return (a, b) => sweetSpotRank(a) - sweetSpotRank(b) || b.firstSeenAt.localeCompare(a.firstSeenAt)
    }
  })()

  // "Sin ver" siempre primero, sea cual sea el orden elegido
  return arr.sort((a, b) => statusRank(a, user) - statusRank(b, user) || secondary(a, b))
}

const SCRAPER_ENABLED = !process.env.NEXT_PUBLIC_VERCEL_ENV
const USER_STORAGE_KEY = 'casas:user'
const VIEW_STORAGE_KEY = 'casas:view'
type ViewMode = 'comfortable' | 'compact'

export default function HomePage() {
  const [allProperties, setAllProperties] = useState<Property[]>([])
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortKey>('recommended')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const PER_PAGE = 48
  const [scraping, setScraping] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<UserId | null>(null)
  const [userInitialized, setUserInitialized] = useState(false)
  const [pendingDupes, setPendingDupes] = useState<number>(0)
  const [viewMode, setViewMode] = useState<ViewMode>('comfortable')
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number; url: string } | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(USER_STORAGE_KEY) : null
    if (saved === 'tomi' || saved === 'flori') setCurrentUser(saved)
    const savedView = typeof window !== 'undefined' ? localStorage.getItem(VIEW_STORAGE_KEY) : null
    if (savedView === 'compact' || savedView === 'comfortable') setViewMode(savedView)
    setUserInitialized(true)
  }, [])

  const handleSetView = useCallback((v: ViewMode) => {
    localStorage.setItem(VIEW_STORAGE_KEY, v)
    setViewMode(v)
  }, [])

  const handleSelectUser = useCallback((u: UserId) => {
    localStorage.setItem(USER_STORAGE_KEY, u)
    setCurrentUser(u)
  }, [])

  const handleSwitchUser = useCallback(() => {
    localStorage.removeItem(USER_STORAGE_KEY)
    setCurrentUser(null)
  }, [])

  const deferredFilters = useDeferredValue(filters)
  const deferredSort = useDeferredValue(sort)

  const loadProperties = useCallback(async () => {
    try {
      setLoadError(null)
      const res = await apiFetch('/api/properties')
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      }
      const data = await res.json() as Property[]
      setAllProperties(data)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (currentUser) loadProperties() }, [loadProperties, currentUser])

  useEffect(() => {
    if (!currentUser) return
    apiFetch('/api/dedupe/candidates')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPendingDupes(d.total ?? 0) })
      .catch(() => {})
  }, [currentUser])

  const handleScrape = useCallback(async () => {
    setScraping(true)
    setScrapeMsg(null)
    try {
      const res = await apiFetch('/api/scrape', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setScrapeMsg(data.newCount > 0 ? `+${data.newCount} nuevas` : 'Sin cambios')
        await loadProperties()
      } else {
        setScrapeMsg('Error al scrapear')
      }
    } catch {
      setScrapeMsg('Error de conexión')
    }
    setScraping(false)
  }, [loadProperties])

  const filteredForStats = useMemo(
    () => currentUser ? applyFilters(allProperties, deferredFilters, currentUser, false) : [],
    [allProperties, deferredFilters, currentUser]
  )

  const filtered = useMemo(
    () => currentUser ? applySort(applyFilters(allProperties, deferredFilters, currentUser), deferredSort, currentUser) : [],
    [allProperties, deferredFilters, deferredSort, currentUser]
  )

  const pageItems = useMemo(() => filtered.slice(0, page * PER_PAGE), [filtered, page])
  const caidasCount = useMemo(() => allProperties.filter(p => !!p.discontinuedAt).length, [allProperties])

  const handleFilterChange = useCallback((patch: Partial<Filters>) => {
    setFilters(f => ({ ...f, ...patch }))
    setPage(1)
  }, [])

  // Aplica un status (sin toast). Devuelve true si ok.
  const applyStatus = useCallback(async (id: string, status: PropertyStatus): Promise<boolean> => {
    if (!currentUser) return false
    const res = await apiFetch(`/api/properties/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, userId: currentUser }),
    })
    if (res.ok) {
      const updated = await res.json() as Property
      setAllProperties(prev => prev.map(p => p.id === id ? updated : p))
      return true
    }
    return false
  }, [currentUser])

  const handleStatusChange = useCallback(async (id: string, status: PropertyStatus) => {
    if (!currentUser) return
    const prev = allProperties.find(p => p.id === id)?.userStatus[currentUser] ?? 'unseen'
    const ok = await applyStatus(id, status)
    if (ok && status !== prev) {
      toast(`Marcada: ${STATUS_LABELS[status]}`, {
        action: { label: 'Deshacer', onClick: () => { void applyStatus(id, prev) } },
        duration: 4000,
      })
    }
  }, [currentUser, allProperties, applyStatus])

  const handleNotesChange = useCallback(async (id: string, notes: string) => {
    if (!currentUser) return
    const res = await apiFetch(`/api/properties/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, userId: currentUser }),
    })
    if (res.ok) {
      const updated = await res.json() as Property
      setAllProperties(prev => prev.map(p => p.id === id ? updated : p))
      toast('Nota guardada')
    }
  }, [currentUser])

  const handleDiscontinuedChange = useCallback(async (id: string, discontinued: boolean) => {
    if (!currentUser) return
    const res = await apiFetch(`/api/properties/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discontinued, userId: currentUser }),
    })
    if (res.ok) {
      const updated = await res.json() as Property
      setAllProperties(prev => prev.map(p => p.id === id ? updated : p))
    }
  }, [currentUser])

  const handleToggleStatusFilter = useCallback((s: PropertyStatus) => {
    if (s === 'seen') {
      const reviewed: PropertyStatus[] = ['seen', 'favorite', 'discarded']
      const allActive = reviewed.every(r => filters.status.includes(r))
      handleFilterChange({
        status: allActive ? filters.status.filter(x => !reviewed.includes(x))
          : Array.from(new Set([...filters.status, ...reviewed])),
      })
    } else {
      handleFilterChange({
        status: filters.status.includes(s) ? filters.status.filter(x => x !== s) : [...filters.status, s],
      })
    }
  }, [filters.status, handleFilterChange])

  const openPhotos = useCallback((p: Property) => {
    if (p.photos.length) setLightbox({ photos: p.photos, index: 0, url: p.url })
  }, [])

  // ── Navegación por teclado (desktop) ──
  useEffect(() => {
    if (!currentUser || lightbox) return
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      const ids = pageItems.map(p => p.id)
      if (ids.length === 0) return
      const idx = focusedId ? ids.indexOf(focusedId) : -1

      const move = (delta: number) => {
        e.preventDefault()
        const next = idx < 0 ? 0 : Math.max(0, Math.min(ids.length - 1, idx + delta))
        const nid = ids[next]
        setFocusedId(nid)
        document.getElementById(`card-${nid}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }

      switch (e.key) {
        case 'j': case 'ArrowDown': move(viewMode === 'compact' ? 2 : 1); break
        case 'k': case 'ArrowUp': move(viewMode === 'compact' ? -2 : -1); break
        case 'ArrowRight': move(1); break
        case 'ArrowLeft': move(-1); break
        case 'f': if (focusedId) { e.preventDefault(); handleStatusChange(focusedId, 'favorite') } break
        case 'x': if (focusedId) { e.preventDefault(); handleStatusChange(focusedId, 'discarded') } break
        case 'v': if (focusedId) { e.preventDefault(); handleStatusChange(focusedId, 'seen') } break
        case 'm': if (focusedId) { e.preventDefault(); handleStatusChange(focusedId, 'maybe') } break
        case 'Enter': {
          const fp = pageItems.find(p => p.id === focusedId)
          if (fp) { e.preventDefault(); openPhotos(fp) }
          break
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentUser, lightbox, pageItems, focusedId, viewMode, handleStatusChange, openPhotos])

  const isPending = filters !== deferredFilters || sort !== deferredSort

  // ── Chips de filtros activos ──
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = []
    filters.zona.forEach(z => chips.push({ key: `z-${z}`, label: z, onRemove: () => handleFilterChange({ zona: filters.zona.filter(x => x !== z) }) }))
    filters.tipo.forEach(t => chips.push({ key: `t-${t}`, label: TIPO_LABELS[t] ?? t, onRemove: () => handleFilterChange({ tipo: filters.tipo.filter(x => x !== t) }) }))
    filters.source.forEach(s => chips.push({ key: `s-${s}`, label: SOURCE_LABELS[s] ?? s, onRemove: () => handleFilterChange({ source: filters.source.filter(x => x !== s) }) }))
    filters.status.forEach(st => chips.push({ key: `st-${st}`, label: STATUS_LABELS[st], onRemove: () => handleFilterChange({ status: filters.status.filter(x => x !== st) }) }))
    if (filters.favBoth) chips.push({ key: 'favboth', label: '★ Fav de ambos', onRemove: () => handleFilterChange({ favBoth: false }) })
    if (filters.discontinued !== 'show') chips.push({ key: 'disc', label: filters.discontinued === 'hide' ? 'Sin no publicadas' : 'Solo no publicadas', onRemove: () => handleFilterChange({ discontinued: 'show' }) })
    if (filters.priceMin || filters.priceMax) chips.push({ key: 'price', label: `USD ${filters.priceMin || '0'}–${filters.priceMax || '∞'}`, onRemove: () => handleFilterChange({ priceMin: '', priceMax: '' }) })
    if (filters.m2Min || filters.m2Max) chips.push({ key: 'm2', label: `${filters.m2Min || '0'}–${filters.m2Max || '∞'} m²`, onRemove: () => handleFilterChange({ m2Min: '', m2Max: '' }) })
    if (filters.roomsMin) chips.push({ key: 'rooms', label: `${filters.roomsMin}+ amb`, onRemove: () => handleFilterChange({ roomsMin: '' }) })
    if (filters.search) chips.push({ key: 'search', label: `"${filters.search}"`, onRemove: () => handleFilterChange({ search: '' }) })
    return chips
  }, [filters, handleFilterChange])

  if (!userInitialized) {
    return <div className="min-h-screen bg-slate-900" />
  }
  if (!currentUser) {
    return <UserSelector onSelect={handleSelectUser} />
  }

  const gridClass = viewMode === 'compact'
    ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'

  return (
    <div className="min-h-screen flex flex-col pb-16 lg:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur border-b border-slate-700/80 px-3 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="casa-headrow text-white">
          <div className="casa-title">
            <h1>Casas</h1>
            <p>Zona Norte · {allProperties.length} props</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          {SCRAPER_ENABLED && scrapeMsg && <span className="text-xs text-accent-400">{scrapeMsg}</span>}
          {SCRAPER_ENABLED && (
            <button onClick={handleScrape} disabled={scraping}
              className="text-xs px-3 py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-slate-700 disabled:text-slate-500 text-accent-fg font-medium transition-colors inline-flex items-center gap-1.5">
              <RefreshCw size={13} className={scraping ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{scraping ? 'Buscando…' : 'Buscar nuevas'}</span>
            </button>
          )}

          {isPending && <Loader2 size={14} className="text-slate-500 animate-spin hidden sm:inline" />}

          {/* Toggle de vista */}
          <div className="flex rounded-lg overflow-hidden border border-slate-600">
            <button onClick={() => handleSetView('comfortable')} title="Vista cómoda" aria-label="Vista cómoda"
              className={`px-2 py-1.5 transition-colors ${viewMode === 'comfortable' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              <Rows3 size={15} />
            </button>
            <button onClick={() => handleSetView('compact')} title="Vista compacta" aria-label="Vista compacta"
              className={`px-2 py-1.5 transition-colors ${viewMode === 'compact' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              <LayoutGrid size={15} />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <ArrowUpDown size={14} className="text-slate-500" />
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
              className="text-xs bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-accent">
              <option value="recommended">Recomendado</option>
              <option value="newest">Más nuevas</option>
              <option value="price_asc">Precio: menor</option>
              <option value="price_desc">Precio: mayor</option>
              <option value="m2_asc">M²: menor</option>
              <option value="m2_desc">M²: mayor</option>
            </select>
          </div>

          <Link href="/oportunidades" className="hidden lg:inline-flex text-xs px-3 py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-accent-fg transition-colors items-center gap-1.5" title="Oportunidades recomendadas">
            <Sparkles size={14} /> Oportunidades
          </Link>
          <Link href="/mapa" className="hidden lg:inline-flex text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors items-center gap-1.5" title="Ver mapa">
            <MapIcon size={14} /> Mapa
          </Link>
          <Link href="/agrupar"
            className={`hidden lg:inline-flex text-xs px-3 py-1.5 rounded-lg text-white transition-colors items-center gap-1.5 ${pendingDupes > 0 ? 'bg-purple-700 hover:bg-purple-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
            title="Revisar candidatas a duplicadas">
            <Link2 size={14} /> Agrupar
            {pendingDupes > 0 && <span className="bg-white/20 text-[10px] font-bold px-1.5 rounded-full">{pendingDupes}</span>}
          </Link>
          <Link href="/caidas" className="hidden lg:inline-flex text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors items-center gap-1.5" title="Avisos caídos">
            <Archive size={14} /> Caídas
            {caidasCount > 0 && <span className="bg-white/20 text-[10px] font-bold px-1.5 rounded-full">{caidasCount}</span>}
          </Link>

          <button onClick={handleSwitchUser}
            className="text-xs text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1 pl-1"
            title="Cambiar usuario">
            <Repeat size={13} /> {USER_LABELS[currentUser]}
          </button>
        </div>
      </header>

      <StatsBar properties={filteredForStats} currentUser={currentUser}
        activeStatusFilters={filters.status} onToggleStatus={handleToggleStatusFilter} />

      {/* Mobile filters drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={() => setMobileFiltersOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-slate-900 p-4 overflow-y-auto shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Filtros</h2>
              <button onClick={() => setMobileFiltersOpen(false)} className="text-slate-400 hover:text-slate-200 p-1"><X size={20} /></button>
            </div>
            <FiltersPanel filters={filters} onChange={handleFilterChange} total={allProperties.length} shown={filtered.length} />
          </aside>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 gap-6 p-3 sm:p-6 max-w-screen-2xl mx-auto w-full">
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-20">
            <FiltersPanel filters={filters} onChange={handleFilterChange} total={allProperties.length} shown={filtered.length} />
          </div>
        </aside>

        <main className={`flex-1 min-w-0 transition-opacity ${isPending ? 'opacity-70' : 'opacity-100'}`}>
          {/* Chips de filtros activos */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {activeChips.map(c => (
                <button key={c.key} onClick={c.onRemove}
                  className="inline-flex items-center gap-1 text-xs bg-slate-800 border border-slate-600 hover:border-slate-400 text-slate-200 pl-2.5 pr-1.5 py-1 rounded-full transition-colors">
                  {c.label} <X size={12} className="text-slate-400" />
                </button>
              ))}
              <button onClick={() => handleFilterChange(DEFAULT_FILTERS)}
                className="text-xs text-slate-500 hover:text-slate-300 underline ml-1">Limpiar todo</button>
            </div>
          )}

          {loading ? (
            <div className={gridClass}>
              {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} compact={viewMode === 'compact'} />)}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-400 gap-2 px-4 text-center">
              <span className="font-semibold">Error cargando propiedades</span>
              <code className="text-xs text-red-300 break-all">{loadError}</code>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <List size={40} className="text-slate-600" />
              <span>Sin resultados con los filtros actuales.</span>
              {activeChips.length > 0 && (
                <button onClick={() => handleFilterChange(DEFAULT_FILTERS)}
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg">Limpiar filtros</button>
              )}
            </div>
          ) : (
            <>
              {filtered.length < allProperties.length && (
                <p className="text-sm text-slate-400 mb-3">Mostrando {filtered.length} de {allProperties.length} propiedades</p>
              )}
              <div ref={gridRef} className={gridClass}>
                {pageItems.map(p => (
                  <div key={p.id} id={`card-${p.id}`}
                    className={focusedId === p.id ? 'rounded-2xl ring-2 ring-accent ring-offset-2 ring-offset-slate-900' : ''}>
                    <PropertyCard
                      property={p}
                      currentUser={currentUser}
                      compact={viewMode === 'compact'}
                      onStatusChange={handleStatusChange}
                      onNotesChange={handleNotesChange}
                      onDiscontinuedChange={handleDiscontinuedChange}
                      onOpenPhotos={openPhotos}
                    />
                  </div>
                ))}
              </div>

              {pageItems.length < filtered.length && (
                <div className="mt-8 flex justify-center">
                  <button onClick={() => setPage(n => n + 1)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-sm px-6 py-2.5 rounded-xl transition-colors">
                    Cargar más ({filtered.length - pageItems.length} restantes)
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Bottom nav (móvil) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-700 flex items-stretch">
        <span className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-accent-400">
          <List size={20} /><span className="text-[10px]">Lista</span>
        </span>
        <Link href="/oportunidades" className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-accent-400 hover:text-accent-300">
          <Sparkles size={20} /><span className="text-[10px]">Oportun.</span>
        </Link>
        <Link href="/mapa" className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-400 hover:text-slate-200">
          <MapIcon size={20} /><span className="text-[10px]">Mapa</span>
        </Link>
        <Link href="/agrupar" className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-400 hover:text-slate-200 relative">
          <Link2 size={20} /><span className="text-[10px]">Agrupar</span>
          {pendingDupes > 0 && <span className="absolute top-1 right-1/4 bg-purple-600 text-white text-[9px] font-bold px-1.5 rounded-full">{pendingDupes}</span>}
        </Link>
        <Link href="/caidas" className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-400 hover:text-slate-200 relative">
          <Archive size={20} /><span className="text-[10px]">Caídas</span>
          {caidasCount > 0 && <span className="absolute top-1 right-1/4 bg-red-600 text-white text-[9px] font-bold px-1.5 rounded-full">{caidasCount}</span>}
        </Link>
        <button onClick={() => setMobileFiltersOpen(true)} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-400 hover:text-slate-200 relative">
          <SlidersHorizontal size={20} /><span className="text-[10px]">Filtros</span>
          {activeChips.length > 0 && <span className="absolute top-1 right-1/4 bg-accent-600 text-accent-fg text-[9px] font-bold px-1.5 rounded-full">{activeChips.length}</span>}
        </button>
      </nav>

      {/* Lightbox de fotos */}
      {lightbox && (
        <PhotoModal
          photos={lightbox.photos}
          index={lightbox.index}
          url={lightbox.url}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox(l => l ? { ...l, index: Math.max(0, l.index - 1) } : l)}
          onNext={() => setLightbox(l => l ? { ...l, index: Math.min(l.photos.length - 1, l.index + 1) } : l)}
        />
      )}
    </div>
  )
}
