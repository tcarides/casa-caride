export default function CardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col rounded-2xl overflow-hidden border border-slate-700/80 bg-surface ${compact ? 'rounded-xl' : ''}`}>
      <div className={`skeleton ${compact ? 'h-28' : 'h-48'}`} />
      <div className="p-3.5 flex flex-col gap-2.5">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-8 w-full rounded-lg mt-1" />
      </div>
    </div>
  )
}
