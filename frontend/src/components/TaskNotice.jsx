export default function TaskNotice({ error, success, onRetry }) {
  if (!error && !success) return null
  return (
    <div role={error ? 'alert' : 'status'} className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-destructive/30 bg-destructive/10 text-foreground' : 'border-success/30 bg-success/10 text-foreground'}`}>
      <p>{error || success}</p>
      {error && onRetry && <button type="button" onClick={onRetry} className="mt-2 font-semibold underline underline-offset-4">Volver a intentar</button>}
    </div>
  )
}
