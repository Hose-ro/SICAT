export default function PageHeader({ title, subtitle, action, level = 1 }) {
  const Heading = `h${level}`
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Heading className="text-xl font-bold text-foreground sm:text-2xl">{title}</Heading>
        {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {action && <div className="w-full sm:w-auto sm:shrink-0">{action}</div>}
    </div>
  )
}
