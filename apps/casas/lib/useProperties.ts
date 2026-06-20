'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import type { Property, PropertyStatus, UserId } from '@/lib/types'

// Estado y mutaciones de propiedades compartidos por home, oportunidades y
// caídas (antes estaban duplicados casi idénticos en las tres páginas).

const USER_STORAGE_KEY = 'casas:user'
const VIEW_STORAGE_KEY = 'casas:view'

const STATUS_LABELS: Record<PropertyStatus, string> = {
  unseen: 'Sin ver', seen: 'Vista', maybe: 'Quizás', favorite: 'Favorita', discarded: 'Descartada',
}

export type ViewMode = 'comfortable' | 'compact'
export interface Lightbox { photos: string[]; index: number; url: string }

export function useProperties() {
  const [allProperties, setAllProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<UserId | null>(null)
  const [userInitialized, setUserInitialized] = useState(false)
  const [viewMode, setViewModeState] = useState<ViewMode>('comfortable')
  const [lightbox, setLightbox] = useState<Lightbox | null>(null)

  // Carga inicial de usuario y modo de vista desde localStorage.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(USER_STORAGE_KEY) : null
    if (saved === 'tomi' || saved === 'flori') setCurrentUser(saved)
    const v = typeof window !== 'undefined' ? localStorage.getItem(VIEW_STORAGE_KEY) : null
    if (v === 'compact' || v === 'comfortable') setViewModeState(v)
    setUserInitialized(true)
  }, [])

  const setViewMode = useCallback((v: ViewMode) => {
    localStorage.setItem(VIEW_STORAGE_KEY, v)
    setViewModeState(v)
  }, [])

  const selectUser = useCallback((u: UserId) => {
    localStorage.setItem(USER_STORAGE_KEY, u)
    setCurrentUser(u)
  }, [])

  const switchUser = useCallback(() => {
    localStorage.removeItem(USER_STORAGE_KEY)
    setCurrentUser(null)
  }, [])

  const loadProperties = useCallback(async () => {
    try {
      setLoadError(null)
      const res = await apiFetch('/api/properties')
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
      }
      setAllProperties(await res.json() as Property[])
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (currentUser) loadProperties() }, [loadProperties, currentUser])

  // Aplica un status sin toast. Devuelve true si el server confirmó.
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
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discontinued, userId: currentUser }),
    })
    if (res.ok) {
      const updated = await res.json() as Property
      setAllProperties(prev => prev.map(p => p.id === id ? updated : p))
      if (!discontinued) toast('Restaurada a publicadas')
    }
  }, [currentUser])

  const openPhotos = useCallback((p: Property) => {
    if (p.photos.length) setLightbox({ photos: p.photos, index: 0, url: p.url })
  }, [])

  return {
    allProperties, setAllProperties,
    loading, loadError, loadProperties,
    currentUser, userInitialized, selectUser, switchUser,
    viewMode, setViewMode,
    lightbox, setLightbox, openPhotos,
    handleStatusChange, handleNotesChange, handleDiscontinuedChange,
  }
}
