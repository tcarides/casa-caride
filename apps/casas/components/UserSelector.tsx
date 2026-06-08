'use client'

import type { UserId } from '@/lib/types'
import { USER_LABELS } from '@/lib/types'

interface Props {
  onSelect: (user: UserId) => void
}

export default function UserSelector({ onSelect }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 p-6">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md w-full flex flex-col gap-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white text-center">
            ¿Quién está usando la app?
          </h1>
          <p className="text-sm text-slate-400 text-center mt-2">
            Tus favoritos y vistos se guardan separados para cada uno.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {(['tomi', 'flori'] as UserId[]).map(u => (
            <button
              key={u}
              onClick={() => onSelect(u)}
              className="flex-1 bg-accent-600 hover:bg-accent-500 active:bg-accent-700 text-white font-semibold py-4 rounded-xl text-lg transition-colors"
            >
              {USER_LABELS[u]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
