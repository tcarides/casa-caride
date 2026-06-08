'use client'
import { apiFetch } from '@/lib/api'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Property } from '@/lib/types'

interface Candidate {
  prop_a: string
  prop_b: string
  hamming: number
  same_address: boolean
  same_price_5pct: boolean
  same_m2_5pct: boolean
  a: Property
  b: Property
}

const SOURCE_LABEL: Record<string, string> = {
  zonaprop: 'ZonaProp',
  argenprob: 'ArgenpProp',
  mercadolibre: 'MercadoLibre',
}

function fmt(n?: number) {
  if (n === undefined || n === null) return '-'
  return n.toLocaleString('es-AR')
}

function PropertyView({ p }: { p: Property }) {
  const priceStr = p.price ? `${p.currency === 'USD' ? 'USD' : '$'} ${fmt(p.price)}` : 'Sin precio'
  return (
    <div className="flex flex-col gap-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="block relative h-56 sm:h-72 bg-slate-700">
        {p.photos?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photos[0]} alt={p.title ?? ''} className="w-full h-full object-cover" />
        )}
        <span className="absolute top-2 left-2 text-xs bg-black/70 text-white px-2 py-0.5 rounded-full">
          {SOURCE_LABEL[p.source] ?? p.source}
        </span>
      </a>
      <div className="px-3 pb-3 flex flex-col gap-1 text-sm">
        <div className="font-semibold text-white text-base">{priceStr}</div>
        <div className="text-slate-300 truncate" title={p.address}>
          {p.address || p.neighborhood || '—'}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          {p.m2Total && <span>{p.m2Total} m²</span>}
          {p.rooms && <span>{p.rooms} amb.</span>}
          {p.bathrooms && <span>{p.bathrooms} baños</span>}
        </div>
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate">
          {p.url}
        </a>
      </div>
    </div>
  )
}

function MetaPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-900/60 text-emerald-200' : 'bg-slate-700 text-slate-400'}`}>
      {ok ? '✓' : '✕'} {label}
    </span>
  )
}

export default function AgruparPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [total, setTotal] = useState(0)
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/dedupe/candidates')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCandidates(data.candidates)
      setTotal(data.total)
      setIdx(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const current = candidates[idx]

  async function decide(action: 'confirm' | 'reject' | 'skip') {
    if (!current) return
    if (action === 'skip') {
      setIdx(i => i + 1)
      return
    }
    setSubmitting(true)
    try {
      await apiFetch(`/api/dedupe/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propA: current.prop_a, propB: current.prop_b }),
      })
      setIdx(i => i + 1)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">Cargando candidatos...</div>
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-red-400 flex flex-col items-center justify-center gap-2 p-6">
        <span className="font-semibold">Error</span>
        <code className="text-xs">{error}</code>
        <Link href="/" className="text-blue-400 hover:underline mt-4">← Volver</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col">
      <header className="bg-slate-900 border-b border-slate-700 px-3 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/" className="text-sm text-blue-400 hover:underline">← Volver</Link>
        <h1 className="text-base sm:text-lg font-bold text-white">Agrupar duplicadas</h1>
        <span className="text-xs text-slate-400 ml-auto">
          {idx >= candidates.length ? `${total} totales` : `${idx + 1} / ${candidates.length} (${total} pendientes)`}
        </span>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-screen-xl mx-auto w-full">
        {!current ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <span className="text-2xl">🎉</span>
            <span className="text-slate-300">No quedan candidatos para revisar.</span>
            <p className="text-xs text-slate-500 max-w-md">
              Para generar más, corré <code className="bg-slate-800 px-1.5 py-0.5 rounded">npm run dedupe</code> en el scraper local.
            </p>
            <Link href="/" className="text-blue-400 hover:underline mt-2">← Volver al listado</Link>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-400">Distancia foto:</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${current.hamming <= 5 ? 'bg-emerald-900/60 text-emerald-200' : 'bg-amber-900/60 text-amber-200'}`}>
                {current.hamming} / 64 bits
              </span>
              <MetaPill label="misma dirección" ok={current.same_address} />
              <MetaPill label="precio similar" ok={current.same_price_5pct} />
              <MetaPill label="m² similar" ok={current.same_m2_5pct} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <PropertyView p={current.a} />
              <PropertyView p={current.b} />
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => decide('confirm')}
                disabled={submitting}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                ✓ Sí, son la misma
              </button>
              <button
                onClick={() => decide('reject')}
                disabled={submitting}
                className="bg-red-800 hover:bg-red-700 disabled:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                ✕ No, distintas
              </button>
              <button
                onClick={() => decide('skip')}
                disabled={submitting}
                className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-300 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                → Saltar
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
