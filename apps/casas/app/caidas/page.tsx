'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Archive } from 'lucide-react'
import PropertyCard from '@/components/PropertyCard'
import PhotoModal from '@/components/PhotoModal'
import UserSelector from '@/components/UserSelector'
import { useProperties } from '@/lib/useProperties'

function fmtDate(iso?: string): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return '' }
}

export default function CaidasPage() {
  const {
    allProperties, loading, loadError,
    currentUser, userInitialized, selectUser,
    viewMode, lightbox, setLightbox, openPhotos,
    handleStatusChange, handleNotesChange, handleDiscontinuedChange,
  } = useProperties()

  const caidas = useMemo(
    () => allProperties
      .filter(p => !!p.discontinuedAt)
      .sort((a, b) => (b.discontinuedAt ?? '').localeCompare(a.discontinuedAt ?? '')),
    [allProperties]
  )

  if (!userInitialized) return <div className="min-h-screen bg-slate-900" />
  if (!currentUser) return <UserSelector onSelect={selectUser} />

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
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/15 text-red-400">
            <Archive size={18} />
          </span>
          <div className="leading-none">
            <div className="text-base font-bold text-white">Caídas</div>
            <div className="text-[10px] text-slate-500">Avisos dados de baja, guardados con sus fotos</div>
          </div>
        </div>
        <span className="ml-auto text-xs text-slate-400">{caidas.length}</span>
      </header>

      <main className="flex-1 p-3 sm:p-6 max-w-screen-2xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">Cargando…</div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-400 gap-2">
            <span className="font-semibold">Error cargando propiedades</span>
            <code className="text-xs text-red-300 break-all">{loadError}</code>
          </div>
        ) : caidas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3 text-center">
            <Archive size={40} className="text-slate-600" />
            <span>Todavía no hay caídas guardadas.</span>
            <p className="text-xs text-slate-500 max-w-md">
              Cuando un aviso se da de baja (lo marcás con 🚫, o lo detecta <code className="bg-slate-800 px-1.5 py-0.5 rounded">npm run cleanup</code>),
              queda guardado acá con sus fotos.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-3">
              {caidas.length} {caidas.length === 1 ? 'propiedad caída' : 'propiedades caídas'}. Se conservan con fotos aunque el aviso ya no exista.
            </p>
            <div className={gridClass}>
              {caidas.map(p => (
                <div key={p.id} className="relative">
                  <PropertyCard
                    property={p}
                    currentUser={currentUser}
                    compact={viewMode === 'compact'}
                    onStatusChange={handleStatusChange}
                    onNotesChange={handleNotesChange}
                    onDiscontinuedChange={handleDiscontinuedChange}
                    onOpenPhotos={openPhotos}
                  />
                  {p.discontinuedAt && !(viewMode === 'compact') && (
                    <span className="absolute bottom-2 right-2 z-10 text-[10px] bg-black/70 text-slate-300 px-2 py-0.5 rounded-full">
                      Caída {fmtDate(p.discontinuedAt)}{p.discontinuedBy === 'cleanup' ? ' · auto' : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

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
