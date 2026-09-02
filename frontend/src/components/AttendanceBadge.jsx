function getConfig(pct) {
  if (pct >= 85) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' }
  }
  if (pct >= 70) {
    return { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', dot: 'bg-amber-400' }
  }
  return { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200', dot: 'bg-rose-500' }
}

export default function AttendanceBadge({ percentage, suffix = '%' }) {
  const pct = percentage ?? 0
  const cfg = getConfig(pct)

  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${cfg.bg} ${cfg.ring}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
      <span className={`text-sm font-bold tabular-nums ${cfg.text}`}>
        {pct}
        {suffix}
      </span>
    </div>
  )
}
