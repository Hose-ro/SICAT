import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import Modal from './Modal'
import { Button } from './ui/button'
import { dismissNotice, resolveConfirmation, useFeedbackStore } from '@/lib/feedback'

export default function FeedbackDialogs() {
  const confirmation = useFeedbackStore((state) => state.confirmation)
  const notices = useFeedbackStore((state) => state.notices)
  const cancelRef = useRef(null)
  useEffect(() => () => resolveConfirmation(false), [])

  return (
    <>
      <Modal open={Boolean(confirmation)} onClose={() => resolveConfirmation(false)} title={confirmation?.title}
        description={confirmation?.description} initialFocus={cancelRef}>
        <div className="flex flex-wrap justify-end gap-3">
          <Button ref={cancelRef} variant="outline" onClick={() => resolveConfirmation(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => resolveConfirmation(true)}>{confirmation?.confirmLabel}</Button>
        </div>
      </Modal>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[400] flex max-h-[50dvh] w-[min(28rem,calc(100%-2rem))] flex-col gap-2 overflow-y-auto">
        {notices.map((notice) => (
          <div key={notice.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm text-foreground">
            <p className="flex-1" role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p>
            <Button variant="ghost" size="icon" aria-label="Descartar notificación" onClick={() => dismissNotice(notice.id)}><X aria-hidden="true" /></Button>
          </div>
        ))}
      </div>
    </>
  )
}
