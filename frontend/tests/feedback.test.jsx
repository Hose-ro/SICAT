import { beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FeedbackDialogs from '../src/components/FeedbackDialogs'
import { Button } from '../src/components/ui/button'
import useAsyncAction from '../src/hooks/useAsyncAction'
import { confirmAction, resolveConfirmation, useFeedbackStore } from '../src/lib/feedback'

beforeEach(() => { resolveConfirmation(false); useFeedbackStore.setState({ notices: [] }) })

function Workflow({ save }) {
 const run = useAsyncAction(async () => {
  if (!await confirmAction({ title: 'Finalizar clase', description: 'Los alumnos sin captura quedarán como falta.', confirmLabel: 'Finalizar clase' })) return
  await save()
 })
 return <><Button onClick={run}>Cerrar clase</Button><FeedbackDialogs /></>
}

test('cancelar y Escape no ejecutan la acción; el foco vuelve al origen', async () => {
 const user=userEvent.setup(), save=vi.fn()
 render(<Workflow save={save} />)
 const trigger=screen.getByRole('button',{name:'Cerrar clase'})
 await user.click(trigger)
 const dialog=await screen.findByRole('dialog',{name:'Finalizar clase'})
 expect(dialog.getAttribute('aria-modal')).toBe('true')
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'Cancelar'})))
 await user.click(screen.getByRole('button',{name:'Cancelar'}))
 expect(save).not.toHaveBeenCalled()
 await waitFor(()=>expect(document.activeElement).toBe(trigger))
 await user.click(trigger)
 await user.keyboard('{Escape}')
 expect(save).not.toHaveBeenCalled()
 await waitFor(()=>expect(document.activeElement).toBe(trigger))
})

test('confirmar ejecuta una sola vez y bloquea mientras la solicitud está pendiente', async () => {
 const user=userEvent.setup();let finish
 const save=vi.fn(()=>new Promise(resolve=>{finish=resolve}))
 render(<Workflow save={save} />)
 const trigger=screen.getByRole('button',{name:'Cerrar clase'})
 await user.dblClick(trigger)
 await user.dblClick(await screen.findByRole('button',{name:'Finalizar clase'}))
 expect(save).toHaveBeenCalledTimes(1)
 await user.click(trigger)
 expect(screen.queryByRole('dialog')).toBeNull()
 expect(save).toHaveBeenCalledTimes(1)
 await act(async()=>finish())
})

test('dos solicitudes concurrentes no comparten una aprobación', async () => {
 const first=confirmAction('Primera acción')
 const duplicate=confirmAction('Segunda acción')
 expect(await duplicate).toBe(false)
 resolveConfirmation(true)
 expect(await first).toBe(true)
 resolveConfirmation(true)
})
