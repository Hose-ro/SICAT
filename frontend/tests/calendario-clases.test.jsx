import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('../src/store/periodoStore', () => ({
  usePeriodoStore: () => ({
    periodo: { clave: '2026-B', fechaInicio: '2026-09-01', fechaFin: '2026-09-30', configurado: true },
    cargarPeriodo: vi.fn(),
  }),
}))

import api from '../src/api/axios'
import CalendarioClases from '../src/components/CalendarioClases'

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: [] })
  api.post.mockResolvedValue({ data: [
    { id: 1, fecha: '2026-09-17', motivo: 'Día festivo' },
    { id: 2, fecha: '2026-09-18', motivo: 'Día festivo' },
  ] })
})

test('permite marcar varios días con clases y muestra el motivo guardado', async () => {
  const user = userEvent.setup()
  render(<CalendarioClases horarios={[{ dias: 'Jueves,Viernes', grupo: { periodo: '2026-A' }, horaInicio: '08:00', horaFin: '10:00' }]} />)

  await user.click(screen.getByRole('button', { name: /Calendario de clases/ }))
  await user.click(screen.getByRole('button', { name: /jueves, 17 de septiembre de 2026: 1 clase/ }))
  await user.click(screen.getByRole('button', { name: /viernes, 18 de septiembre de 2026: 1 clase/ }))
  await user.type(screen.getByLabelText('Motivo por el que no habrá clases'), 'Día festivo')
  await user.click(screen.getByRole('button', { name: 'Marcar sin clases' }))

  await waitFor(() => expect(api.post).toHaveBeenCalledWith(
    '/periodos/actual/suspensiones',
    { fechas: ['2026-09-17', '2026-09-18'], motivo: 'Día festivo' },
  ))
  expect(await screen.findByRole('button', { name: /jueves, 17 de septiembre de 2026: sin clases, Día festivo/ })).toBeTruthy()
})

test('el docente ve el festivo institucional pero no puede tocarlo', async () => {
  const user = userEvent.setup()
  api.get.mockResolvedValue({ data: [
    { id: 1, fecha: '2026-09-17', motivo: 'Independencia', institucional: true },
    { id: 4, fecha: '2026-09-18', motivo: 'Congreso', institucional: false },
  ] })
  render(<CalendarioClases horarios={[{ dias: 'Jueves,Viernes', horaInicio: '08:00', horaFin: '10:00' }]} />)

  await user.click(screen.getByRole('button', { name: /Calendario de clases/ }))
  const festivo = await screen.findByRole('button', { name: /17 de septiembre de 2026: sin clases \(institucional\), Independencia/ })
  expect(festivo.disabled).toBe(true)
  expect(festivo.textContent).toContain('Festivo')
  expect(screen.getByText(/festivo institucional: Independencia/)).toBeTruthy()

  // El propio sí se puede restablecer.
  await user.click(screen.getByRole('button', { name: /18 de septiembre de 2026: sin clases, Congreso/ }))
  expect(screen.getByRole('button', { name: 'Restablecer clases de este día' })).toBeTruthy()
})

test('en modo institucional el admin marca cualquier día del periodo para todos', async () => {
  const user = userEvent.setup()
  api.post.mockResolvedValue({ data: [{ id: 1, fecha: '2026-09-16', motivo: 'Independencia' }] })
  render(<CalendarioClases modo="institucional" />)

  await user.click(screen.getByRole('button', { name: /Calendario escolar/ }))
  expect(api.get).toHaveBeenCalledWith('/periodos/actual/suspensiones-institucionales')
  await user.click(screen.getByRole('button', { name: /miércoles, 16 de septiembre de 2026: día del periodo/ }))
  await user.type(screen.getByLabelText('Motivo por el que no habrá clases'), 'Independencia')
  await user.click(screen.getByRole('button', { name: 'Marcar festivo para todos' }))

  await waitFor(() => expect(api.post).toHaveBeenCalledWith(
    '/periodos/actual/suspensiones-institucionales',
    { fechas: ['2026-09-16'], motivo: 'Independencia' },
  ))
  expect(await screen.findByRole('button', { name: /16 de septiembre de 2026: sin clases, Independencia/ })).toBeTruthy()
})
