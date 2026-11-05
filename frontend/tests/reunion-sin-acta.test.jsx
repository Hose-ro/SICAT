import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import api from '@/api/axios'
import ReunionForm from '@/pages/jefe-carrera/reuniones/ReunionForm'
import { tieneActa } from '@/lib/reuniones'
vi.mock('@/api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/lib/actaReunion', () => ({
  academiaDe: () => 'Academia de Sistemas',
  generarApertura: () => 'Apertura generada',
}))
beforeEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: [{ id: 37, nombre: 'Laura' }] })
  api.post.mockResolvedValue({ data: { convocados: [{ id: 37 }], clasesJustificadas: [{ id: 1 }] } })
})
function abrir() {
  render(
    <ReunionForm
      j={{ carreraId: '1', carrera: { nombre: 'Sistemas' } }}
      academia="Academia de Sistemas"
      onClose={vi.fn()}
      onGuardada={vi.fn()}
    />,
  )
}
it('programa y avisa con el acta desactivada por defecto', async () => {
  abrir()
  await screen.findByText('Laura')
  expect(screen.queryByText('Datos del acta')).toBeNull()
  fireEvent.change(screen.getByLabelText('Título', { exact: true }), { target: { value: 'Junta de seguimiento' } })
  fireEvent.change(screen.getByLabelText('Fecha', { exact: true }), { target: { value: '2026-12-01' } })
  fireEvent.change(screen.getByLabelText('Hora de inicio', { exact: true }), { target: { value: '12:00' } })
  fireEvent.change(screen.getByLabelText('Lugar', { exact: true }), { target: { value: 'Sala B' } })
  fireEvent.click(screen.getByRole('button', { name: 'Programar y avisar' }))
  await waitFor(() => expect(api.post).toHaveBeenCalled())
  const payload = api.post.mock.calls[0][1]
  expect(payload).toMatchObject({ titulo: 'Junta de seguimiento', convocados: [37], carreraId: 1 })
  expect(payload).not.toHaveProperty('academia')
  expect(payload).not.toHaveProperty('apertura')
  expect(payload).not.toHaveProperty('presidenteId')
})
it('permite optar por el acta sin hacerla obligatoria para otras reuniones', async () => {
  abrir()
  await screen.findByText('Laura')
  const check = screen.getByRole('checkbox', { name: 'Preparar datos del acta ahora (opcional)' })
  fireEvent.click(check)
  expect(screen.getByLabelText('Academia', { exact: true })).toBeTruthy()
  fireEvent.click(check)
  expect(screen.queryByLabelText('Academia', { exact: true })).toBeNull()
  expect(tieneActa({ estado: 'PROGRAMADA', puntos: [{ descripcion: 'Agenda' }] })).toBe(false)
  expect(tieneActa({ estado: 'PROGRAMADA', apertura: 'Acta preparada' })).toBe(true)
})
