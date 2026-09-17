import { create } from 'zustand'

export const useFeedbackStore = create(() => ({ confirmation: null, notices: [] }))

// Sharing a promise between two handlers would execute the action twice.
export function confirmAction(options) {
  if (useFeedbackStore.getState().confirmation) return Promise.resolve(false)
  const config = typeof options === 'string' ? { description: options } : options
  return new Promise((resolve) => {
    useFeedbackStore.setState({ confirmation: { title: 'Confirmar acción', confirmLabel: 'Confirmar', ...config, resolve } })
  })
}

export function resolveConfirmation(confirmed) {
  const pending = useFeedbackStore.getState().confirmation
  if (!pending) return
  useFeedbackStore.setState({ confirmation: null })
  pending.resolve(confirmed)
}

export function notify(message, tone = 'error') {
  const id = crypto.randomUUID()
  useFeedbackStore.setState(({ notices }) => ({ notices: [...notices, { id, message, tone }] }))
}

export function dismissNotice(id) {
  useFeedbackStore.setState(({ notices }) => ({ notices: notices.filter((notice) => notice.id !== id) }))
}
