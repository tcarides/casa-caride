'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Sparkles } from 'lucide-react'
import PropertyCard from '@/components/PropertyCard'
import PhotoModal from '@/components/PhotoModal'
import UserSelector from '@/components/UserSelector'
import { rankOpportunities, computeMarketStats } from '@/lib/opportunities'
import type { Property, PropertyStatus, UserId } from '@/lib/types'

const USER_STORAGE_KEY = 'casas:user'
const VIEW_STORAGE_KEY = 'casas:view'
const STATUS_LABELS: Record<PropertyStatus, string> = {
  unseen: 'Sin ver', seen: 'Vista', maybe: 'Quizás', favorite: 'Favorita', discarded: 'Descartada',
}
const fmt = (n: number) => new Intl.NumberFormat('es-AR').format(n)

export default function OportunidadesPage() {
  const [allProperties, setAllProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<UserId | null>(null)
  const [userInitialized, setUserInitialized] = useState(false)
  const [viewMode, setViewMode] = useState<'comfortable' | 'compact'>('comfortable')
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number; url: string } | null>(null)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(USER_STORAGE_KEY) : null
    if (saved === 'tomi' || saved === 'flori') setCurrentUser(saved)
    const v = typeof window !== 'undefined' ? localStorage.getItem(VIEW_STORAGE_KEY) : null
    if (v === 'compact' || v === 'comfortable') setViewMode(v)
    setUserInitialized(true)
  }, [])

  const handleSelectUser = useCallback((u: UserId) => {
    localStorage.setItem(USER_STORAGE_KEY, u); setCurrentUser(u)
  }, [])

  const loadProperties = useCallback(async () => {
    try {
      setLoadError(null)
      const res = await fetch('/api/properties')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setAllProperties(await res.json() as Property[])
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (currentUser) loadProperties() }, [loadProperties, currentUser])

  // Excluir descartadas por el usuario actual
  const visible = useMemo(
    () => allProperties.filter(p => (currentUser ? p.userStatus[currentUser] : undefined) !== 'discarded'),
    [allProperties, currentUser],
  )
  const opps = useMemo(() => rankOpportunities(visible), [visible])
  const stats = useMemo(() => computeMarketStats(visible), [visible])
  const inBudget = useMemo(
    () => opps.filter(p => p.price! >= 300_000 && p.price! <= 500_000).length, [opps],
  )

  const applyStatus = useCallback(async (id: string, status: PropertyStatus): Promise<boolean> => {
    if (!currentUser) return false
    const res = await fetch(`/api/properties/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, userId: currentUser }),
    })
    if (res.ok) { const u = await res.json() as Property; setAllProperties(prev => prev.map(p => p.id === id ? u : p)); return true }
    return false
  }, [currentUser])

  const handleStatusChange = useCallback(async (id: string, status: PropertyStatus) => {
    if (!currentUser) return
    const prev = allProperties.find(p => p.id === id)?.userStatus[currentUser] ?? 'unseen'
    const ok = await applyStatus(id, status)
    if (ok && status !== prev) toast(`Marcada: ${STATUS_LABELS[status]}`, {
      action: { label: 'Deshacer', onClick: () => { void applyStatus(id, prev) } }, duration: 4000,
    })
  }, [currentUser, allProperties, applyStatus])

  const handleNotesChange = useCallback(async (id: string, notes: string) => {
    if (!currentUser) return
    const res = await fetch(`/api/properties/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, userId: currentUser }),
    })
    if (res.ok) { const u = await res.json() as Property; setAllProperties(prev => prev.map(p => p.id === id ? u : p)); toast('Nota guardada') }
  }, [currentUser])

  const handleDiscontinuedChange = useCallback(async (id: string, discontinued: boolean) => {
    if (!currentUser) return
    const res = await fetch(`/api/properties/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discontinued, userId: currentUser }),
    })
    if (res.ok) { const u = await res.json() as Property; setAllProperties(prev => prev.map(p => p.id === id ? u : p)) }
  }, [currentUser])

  const openPhotos = useCallback((p: Property) => {
    if (p.photos.length) setLightbox({ photos: p.photos, index: 0, url: p.url })
  }, [])

  if (!userInitialized) return <div className="min-h-screen bg-slate-900" />
  if (!currentUser) return <UserSelector onSelect={handleSelectUser} />

  const gridClass = viewMode === 'compact'
    ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur border-b border-slate-700/80 px-3 sm:px-6 py-2.5 flex items-center gap-3">
        <Link href="/" className="text-slate-400 hover:text-white inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> Volver
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent-500/15 text-accent-400">
            <Sparkles size={18} />
          </span>
          <div className="leading-none">
            <div className="text-base font-bold text-white">Oportunidades</div>
            <div className="text-[10px] text-slate-500">Casas bien rankeadas por precio/m², zona y tus preferencias</div>
          </div>
        </div>
        <span className="ml-auto text-xs text-slate-400">{opps.length}</span>
      </header>

      <main className="flex-1 p-3 sm:p-6 max-w-screen-2xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">Calculando oportunidades…</div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-400 gap-2">
            <span className="font-semibold">Error cargando propiedades</span>
            <code className="text-xs text-red-300 break-all">{loadError}</code>
          </div>
        ) : (
          <>
            {/* Métricas de mercado (v1) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <Stat label="Oportunidades" value={String(opps.length)} />
              <Stat label="En presupuesto 300-500k" value={String(inBudget)} />
              <Stat label="$/m² mediano (mercado)" value={`USD ${fmt(stats.globalMedian)}`} />
              <Stat label="Barrios con muestra" value={String(stats.byBarrio.size)} />
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Ranking provisorio (v1): pondera $/m² vs el promedio del barrio, zona preferida, presupuesto y criterios de la casa.
              ArgenProp queda afuera por ahora (sin precio). Lo afinamos con tu feedback.
            </p>

            {opps.length > 150 && (
              <p className="text-[11px] text-slate-500 mb-2">Mostrando las 150 mejores de {opps.length}.</p>
            )}
            <div className={gridClass}>
              {opps.slice(0, 150).map(p => (
                <div key={p.id} className="relative flex flex-col">
                  <span className="absolute top-2 left-2 z-10 text-[11px] font-bold bg-accent-600 text-white px-2 py-0.5 rounded-full shadow">
                    {p.opp.score}
                  </span>
                  <PropertyCard
                    property={p}
                    currentUser={currentUser}
                    compact={viewMode === 'compact'}
                    onStatusChange={handleStatusChange}
                    onNotesChange={handleNotesChange}
                    onDiscontinuedChange={handleDiscontinuedChange}
                    onOpenPhotos={openPhotos}
                  />
                  {viewMode !== 'compact' && p.opp.reasons.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.opp.reasons.map((r, i) => (
                        <span key={i} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {lightbox && (
        <PhotoModal
          photos={lightbox.photos} index={lightbox.index} url={lightbox.url}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox(l => l ? { ...l, index: Math.max(0, l.index - 1) } : l)}
          onNext={() => setLightbox(l => l ? { ...l, index: Math.min(l.photos.length - 1, l.index + 1) } : l)}
        />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/60 rounded-lg px-3 py-2">
      <div className="text-base font-bold text-white">{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  )
}
