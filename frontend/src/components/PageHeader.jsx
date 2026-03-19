export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">{title}</h2>
        {subtitle && <div className="mt-1 text-sm text-gray-500">{subtitle}</div>}
      </div>
      {action && <div className="w-full sm:w-auto sm:shrink-0">{action}</div>}
    </div>
  )
}
