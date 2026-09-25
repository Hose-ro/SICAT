import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api/axios', () => ({ default: { patch: vi.fn() } }))

import api from '../src/api/axios'
import UnidadesCard from '../src/pages/materia/UnidadesCard'

const materia = (unidades) => ({ id: 5, numUnidades: unidades.length, unidades })

beforeEach(() => {
  vi.clearAllMocks()
})

test('solo la unidad ACTIVA muestra el botón de cancelar inicio', async () => {
  const unidades = [
    { id: 1, orden: 1, nombre: 'Unidad 1', status: 'FINALIZADA', fechaInicio: '2026-08-01T06:00:00.000Z', fechaFin: '2026-08-30T06:00:00.000Z' },
    { id: 3, orden: 3, nombre: 'Unidad 3', status: 'ACTIVA', fechaInicio: '2026-09-24T14:00:00.000Z', fechaFin: null },
  ]
  render(<UnidadesCard materia={materia(unidades)} puedeEditar onActualizado={vi.fn()} />)

  expect(screen.getAllByRole('button', { name: 'Cancelar inicio' })).toHaveLength(1)
})

test('cancelar inicio pide confirmación y luego llama al endpoint de cancelar', async () => {
  const user = userEvent.setup()
  const onActualizado = vi.fn()
  api.patch.mockResolvedValue({ data: { id: 3, status: 'PENDIENTE' } })
  const unidades = [
    { id: 3, orden: 3, nombre: 'Unidad 3', status: 'ACTIVA', fechaInicio: '2026-09-24T14:00:00.000Z', fechaFin: null },
  ]
  render(<UnidadesCard materia={materia(unidades)} puedeEditar onActualizado={onActualizado} />)

  await user.click(screen.getByRole('button', { name: 'Cancelar inicio' }))
  expect(api.patch).not.toHaveBeenCalled()
  expect(screen.getByText(/volverá a quedar pendiente/)).toBeTruthy()

  await user.click(screen.getByRole('button', { name: 'Sí, cancelar inicio' }))

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/unidades/3/cancelar'))
  await waitFor(() => expect(onActualizado).toHaveBeenCalled())
})

test('editar fechas manda solo lo que el docente cambió, con hora fija', async () => {
  const user = userEvent.setup()
  const onActualizado = vi.fn()
  api.patch.mockResolvedValue({ data: { id: 1, status: 'FINALIZADA' } })
  const unidades = [
    { id: 1, orden: 1, nombre: 'Unidad 1', status: 'FINALIZADA', fechaInicio: '2026-08-01T06:00:00.000Z', fechaFin: '2026-08-30T06:00:00.000Z' },
  ]
  render(<UnidadesCard materia={materia(unidades)} puedeEditar onActualizado={onActualizado} />)

  await user.click(screen.getByRole('button', { name: 'Editar fechas' }))
  const inicio = screen.getByLabelText('Inicio')
  await user.clear(inicio)
  await user.type(inicio, '2026-08-10')
  await user.click(screen.getByRole('button', { name: 'Guardar fechas' }))

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/unidades/1/fechas', {
    fechaInicio: '2026-08-10T00:00',
    fechaFin: '2026-08-30T00:00',
  }))
  await waitFor(() => expect(onActualizado).toHaveBeenCalled())
})

test('un error del servidor al cancelar se muestra y no oculta el botón de confirmar', async () => {
  const user = userEvent.setup()
  api.patch.mockRejectedValue({ response: { data: { message: 'La unidad no está activa' } } })
  const unidades = [
    { id: 3, orden: 3, nombre: 'Unidad 3', status: 'ACTIVA', fechaInicio: '2026-09-24T14:00:00.000Z', fechaFin: null },
  ]
  render(<UnidadesCard materia={materia(unidades)} puedeEditar onActualizado={vi.fn()} />)

  await user.click(screen.getByRole('button', { name: 'Cancelar inicio' }))
  await user.click(screen.getByRole('button', { name: 'Sí, cancelar inicio' }))

  expect(await screen.findByText('La unidad no está activa')).toBeTruthy()
})
