import { Button } from '@/components/ui/button'
export default function TaskNotice({ error, success, onRetry }) {
  if (!error && !success) return null
  return (
    <div role={error ? 'alert' : 'status'} className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-destructive/45 bg-destructive/18 text-foreground' : 'border-success/45 bg-success/18 text-foreground'}`}>
      <p>{error || success}</p>
      {error && onRetry && <Button variant="ghost" type="button" onClick={onRetry} className="mt-2 font-semibold underline underline-offset-4">Volver a intentar</Button>}
    </div>
  )
}
