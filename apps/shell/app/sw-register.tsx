'use client'

import { useEffect } from 'react'

/**
 * Registra el service worker de la PWA en la raíz (scope "/"), de modo que
 * controle todas las mini-apps servidas bajo el mismo origen.
 */
export function SWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => console.error('SW registro falló:', err))
    }
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
