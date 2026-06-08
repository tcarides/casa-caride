'use client'

import type { Property, PropertyStatus, UserId } from '@/lib/types'
import { USER_LABELS } from '@/lib/types'

interface UserStats {
  unseen: number
  reviewed: number   // seen + maybe + favorite + discarded (cualquier revisión)
  maybe: number
  favorite: number
  discarded: number
}

function computeStats(properties: Property[], user: UserId): UserStats {
  const s: UserStats = { unseen: 0, reviewed: 0, maybe: 0, favorite: 0, discarded: 0 }
  for (const p of properties) {
    const st: PropertyStatus = p.userStatus[user] ?? 'unseen'
    if (st === 'unseen') s.unseen++
    else {
      s.reviewed++
      if (st === 'maybe') s.maybe++
      else if (st === 'favorite') s.favorite++
      else if (st === 'discarded') s.discarded++
    }
  }
  return s
}

const REVIEWED_STATUSES: PropertyStatus[] = ['seen', 'maybe', 'favorite', 'discarded']

interface Props {
  properties: Property[]   // ya filtradas (excepto por status del usuario actual)
  currentUser: UserId
  // filters de status del current user — para resaltar el botón activo
  activeStatusFilters: PropertyStatus[]
  onToggleStatus: (s: PropertyStatus) => void
}

interface StatChipProps {
  label: string
  count: number
  color: string
  active?: boolean
  clickable?: boolean
  onClick?: () => void
  title?: string
}

function StatChip({ label, count, color, active, clickable, onClick, title }: StatChipProps) {
  const base = `text-xs px-2 py-0.5 rounded transition-colors ${color}`
  if (clickable) {
    return (
      <button
        onClick={onClick}
        title={title}
        className={`${base} ${active ? 'ring-1 ring-white/40 font-semibold' : 'opacity-80 hover:opacity-100'}`}
      >
        {count} {label}
      </button>
    )
  }
  return (
    <span className={`${base} opacity-70`} title={title}>
      {count} {label}
    </span>
  )
}

function UserRow({
  user,
  stats,
  isCurrent,
  activeStatusFilters,
  onToggleStatus,
}: {
  user: UserId
  stats: UserStats
  isCurrent: boolean
  activeStatusFilters: PropertyStatus[]
  onToggleStatus: (s: PropertyStatus) => void
}) {
  const cls = (s: PropertyStatus) => {
    switch (s) {
      case 'unseen': return 'bg-slate-700 text-blue-300'
      case 'seen': return 'bg-blue-900/60 text-blue-200'
      case 'maybe': return 'bg-purple-900/60 text-purple-200'
      case 'favorite': return 'bg-amber-900/60 text-amber-200'
      case 'discarded': return 'bg-red-900/60 text-red-200'
    }
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isCurrent ? 'bg-accent-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
        {USER_LABELS[user]}{isCurrent ? ' (vos)' : ''}
      </span>
      <StatChip
        label="sin ver"
        count={stats.unseen}
        color={cls('unseen')}
        clickable={isCurrent}
        active={isCurrent && activeStatusFilters.includes('unseen')}
        onClick={() => onToggleStatus('unseen')}
        title="Sin ver"
      />
      <StatChip
        label="✓ vistas"
        count={stats.reviewed}
        color={cls('seen')}
        clickable={isCurrent}
        active={isCurrent && REVIEWED_STATUSES.every(s => activeStatusFilters.includes(s))}
        onClick={() => onToggleStatus('seen')}
        title="Vistas (incluye favoritas y descartadas)"
      />
      <StatChip
        label="?"
        count={stats.maybe}
        color={cls('maybe')}
        clickable={isCurrent}
        active={isCurrent && activeStatusFilters.includes('maybe')}
        onClick={() => onToggleStatus('maybe')}
        title="Quizás"
      />
      <StatChip
        label="★"
        count={stats.favorite}
        color={cls('favorite')}
        clickable={isCurrent}
        active={isCurrent && activeStatusFilters.includes('favorite')}
        onClick={() => onToggleStatus('favorite')}
        title="Favoritas"
      />
      <StatChip
        label="✕"
        count={stats.discarded}
        color={cls('discarded')}
        clickable={isCurrent}
        active={isCurrent && activeStatusFilters.includes('discarded')}
        onClick={() => onToggleStatus('discarded')}
        title="Descartadas"
      />
    </div>
  )
}

export default function StatsBar({ properties, currentUser, activeStatusFilters, onToggleStatus }: Props) {
  const otherUser: UserId = currentUser === 'tomi' ? 'flori' : 'tomi'
  const myStats = computeStats(properties, currentUser)
  const otherStats = computeStats(properties, otherUser)

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-3 sm:px-6 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
      <UserRow
        user={currentUser}
        stats={myStats}
        isCurrent
        activeStatusFilters={activeStatusFilters}
        onToggleStatus={onToggleStatus}
      />
      <UserRow
        user={otherUser}
        stats={otherStats}
        isCurrent={false}
        activeStatusFilters={[]}
        onToggleStatus={() => {}}
      />
    </div>
  )
}
