'use client'

import { useEffect } from 'react'
import { ExternalLink, X } from 'lucide-react'

interface Props {
  photos: string[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  url?: string   // link a la publicación original
}

export default function PhotoModal({ photos, index, onClose, onPrev, onNext, url }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onPrev() }}
        className="absolute left-4 text-white text-4xl font-bold hover:text-gray-300 px-4 py-2 disabled:opacity-20"
        disabled={index === 0}
      >
        ‹
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[index]}
        alt={`Foto ${index + 1}`}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={e => e.stopPropagation()}
      />

      <button
        onClick={(e) => { e.stopPropagation(); onNext() }}
        className="absolute right-4 text-white text-4xl font-bold hover:text-gray-300 px-4 py-2 disabled:opacity-20"
        disabled={index === photos.length - 1}
      >
        ›
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <span className="text-white text-sm opacity-70">{index + 1} / {photos.length}</span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <ExternalLink size={15} /> Ver aviso
          </a>
        )}
      </div>

      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 p-1"
        aria-label="Cerrar"
      >
        <X size={26} />
      </button>
    </div>
  )
}
