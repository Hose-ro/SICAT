function getConfig(pct) {
  if (pct >= 85) {
    return { bg: "bg-success/10", text: "text-success-foreground", ring: "ring-ring", dot: "bg-success" }
  }
  if (pct >= 70) {
    return { bg: "bg-warning/10", text: "text-warning-foreground", ring: "ring-ring", dot: "bg-warning/15" }
  }
  return { bg: "bg-destructive/10", text: "text-destructive-foreground", ring: "ring-ring", dot: "bg-destructive" }
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
