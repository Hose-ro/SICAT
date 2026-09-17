import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

export default function Modal({
  open, onClose, title, children, wide = false, description,
  initialFocus, finalFocus, busy = false, className, bodyClassName,
}) {
  return (
    <Dialog.Root open={Boolean(open)} onOpenChange={(next) => { if (!next && !busy) onClose?.() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop print-hidden" />
        <Dialog.Popup aria-modal="true" className={cn('dialog-panel print-hidden', wide && 'dialog-panel--wide', className)}
          initialFocus={initialFocus} finalFocus={finalFocus} aria-busy={busy || undefined}>
          <div className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>}
            </div>
            <Button variant="ghost" size="icon" disabled={busy} onClick={onClose} aria-label="Cerrar diálogo"><X aria-hidden="true" /></Button>
          </div>
          <div className={cn('space-y-4 p-4 sm:p-5', bodyClassName)}>{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
