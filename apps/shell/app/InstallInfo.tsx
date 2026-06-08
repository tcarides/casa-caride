'use client'

import { useEffect, useState } from 'react'

/**
 * Botón "i" en la home que abre un diálogo con instrucciones para instalar
 * la PWA en la pantalla de inicio, tanto en Android como en iPhone.
 */
export function InstallInfo() {
  const [open, setOpen] = useState(false)

  // Cerrar con Escape y bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        className="info-btn"
        aria-label="Cómo instalar la app"
        onClick={() => setOpen(true)}
      >
        i
      </button>

      {open && (
        <div
          className="info-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Cómo instalar Casa Caride"
          onClick={() => setOpen(false)}
        >
          <div className="info-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="info-sheet__head">
              <h2 className="info-sheet__title">Instalá Casa Caride 📲</h2>
              <button
                type="button"
                className="info-sheet__close"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <p className="info-sheet__intro">
              Sumá la app a tu pantalla de inicio para abrirla como una app más,
              sin barra del navegador.
            </p>

            <div className="info-step">
              <h3 className="info-step__title">🤖 Android (Chrome)</h3>
              <ol className="info-step__list">
                <li>Abrí esta página en Chrome.</li>
                <li>Tocá el menú ⋮ (arriba a la derecha).</li>
                <li>
                  Elegí <strong>“Agregar a pantalla principal”</strong> o{' '}
                  <strong>“Instalar app”</strong>.
                </li>
                <li>Confirmá y listo: ya tenés el ícono de la casa.</li>
              </ol>
            </div>

            <div className="info-step">
              <h3 className="info-step__title">🍎 iPhone (Safari)</h3>
              <ol className="info-step__list">
                <li>Abrí esta página en Safari (no en Chrome).</li>
                <li>
                  Tocá el botón <strong>Compartir</strong> (el cuadrado con la
                  flecha hacia arriba ⬆️).
                </li>
                <li>
                  Bajá y elegí{' '}
                  <strong>“Agregar a inicio”</strong> / “Add to Home Screen”.
                </li>
                <li>
                  Tocá <strong>“Agregar”</strong> arriba a la derecha.
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
