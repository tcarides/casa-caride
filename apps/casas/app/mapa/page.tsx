'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { Property } from '@/lib/types'

// Leaflet usa window — solo cliente
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-slate-400">Cargando mapa...</div>,
})

export default function MapaPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/properties')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(setProperties)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const withCoords = properties.filter(p => typeof p.lat === 'number' && typeof p.lon === 'number')

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <header className="bg-slate-900 border-b border-slate-700 px-3 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/" className="text-sm text-blue-400 hover:underline">← Volver</Link>
        <h1 className="text-base sm:text-lg font-bold text-white">Mapa</h1>
        <span className="text-xs text-slate-400 ml-auto">
          {loading ? 'Cargando...' : `${withCoords.length} de ${properties.length} en el mapa`}
        </span>
      </header>

      <div className="flex-1 relative">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-2">
            <span className="font-semibold">Error</span>
            <code className="text-xs">{error}</code>
          </div>
        ) : loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">Cargando propiedades...</div>
        ) : withCoords.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 px-6 text-center">
            <span>Ninguna propiedad tiene coordenadas todavía.</span>
            <p className="text-xs text-slate-500 max-w-md">
              Corré <code className="bg-slate-800 px-1.5 py-0.5 rounded">npm run geocode</code> en el scraper local para asignarles lat/lon.
            </p>
          </div>
        ) : (
          <MapView properties={withCoords} />
        )}
      </div>
    </div>
  )
}
