import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), put: vi.fn() } }))

import api from '../src/api/axios'
import PeriodoEscolarCard from '../src/components/PeriodoEscolarCard'
import { usePeriodoStore } from '../src/store/periodoStore'

const escolarizado = { clave: '2026-B', modalidad: 'ESCOLARIZADO', fechaInicio: '2026-08-31', fechaFin: '2026-12-18', configurado: true, aplica: true }
const mixto = { clave: '2026-B', modalidad: 'MIXTO', fechaInicio: '2026-09-05', fechaFin: '2026-12-12', configurado: false, aplica: true }
const respuesta = (extra = {}) => ({
  clave: '2026-B',
  escolarizado,
  mixto,
  rango: { fechaInicio: '2026-08-31', fechaFin: '2026-12-18' },
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  usePeriodoStore.setState({ periodos: null })
})

test('un docente sin grupos mixtos ve un solo periodo, sin etiqueta', async () => {
  api.get.mockResolvedValue({ data: respuesta({ mixto: { ...mixto, aplica: false } }) })
  render(<PeriodoEscolarCard editable />)

  expect(await screen.findByText(/Del 31 de agosto de 2026 al 18 de diciembre de 2026/)).toBeTruthy()
  expect(screen.queryByText('Mixto')).toBeNull()
  expect(screen.getAllByRole('button', { name: /fechas/ })).toHaveLength(1)
})

test('con grupos mixtos aparece el segundo calendario; el fin se propone al sábado 16', async () => {
  const user = userEvent.setup()
  api.get.mockResolvedValue({ data: respuesta() })
  api.put.mockResolvedValue({ data: respuesta({ mixto: { ...mixto, fechaInicio: '2026-09-12', fechaFin: '2026-12-26', configurado: true } }) })
  render(<PeriodoEscolarCard editable />)

  const bloque = await screen.findByRole('article', { name: 'Periodo mixto' })
  expect(bloque.textContent).toContain('sábados')
  expect(bloque.textContent).toContain('Fechas estimadas')
  await user.click(screen.getByRole('button', { name: 'Establecer fechas' }))

  const inicio = screen.getByLabelText('Inicio del semestre mixto')
  const fin = screen.getByLabelText('Fin del semestre mixto')
  // Un lunes no sirve: se avisa antes de mandar nada.
  await user.clear(inicio)
  await user.type(inicio, '2026-09-14')
  expect(screen.getByText('El semestre mixto inicia en sábado.')).toBeTruthy()
  await user.clear(inicio)
  await user.type(inicio, '2026-09-12')
  expect(screen.queryByText('El semestre mixto inicia en sábado.')).toBeNull()
  // 12 de septiembre + 15 semanas = sábado 26 de diciembre.
  expect(fin.value).toBe('2026-12-26')
  await user.click(screen.getByRole('button', { name: 'Guardar fechas' }))

  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/periodos/actual', {
    modalidad: 'MIXTO',
    fechaInicio: '2026-09-12',
    fechaFin: '2026-12-26',
  }))
  expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Fechas del periodo mixto actualizadas.')
  expect(screen.getByText(/Del 12 de septiembre de 2026 al 26 de diciembre de 2026/)).toBeTruthy()
})

test('el mixto se cuenta en sábados y avisa cuando un festivo lo deja corto', async () => {
  const sabados = {
    requeridos: 16,
    total: 16,
    conClase: 15,
    transcurridos: 5,
    sinClases: [{ fecha: '2026-11-21', motivo: 'Revolución', institucional: true }],
    finSugerido: '2026-12-26',
  }
  api.get.mockResolvedValue({ data: respuesta({
    mixto: { ...mixto, fechaInicio: '2026-09-05', fechaFin: '2026-12-19', configurado: true, sabados },
  }) })
  render(<PeriodoEscolarCard editable />)

  const bloque = await screen.findByRole('article', { name: 'Periodo mixto' })
  expect(bloque.textContent).toContain('Van 5 de 15 sábados de clase; quedan 10.')
  expect(screen.getByRole('note').textContent).toBe(
    'Con 1 sábado sin clases (21 nov) sólo hay 15 de 16 sábados de clase; extiende el fin al 26 de diciembre de 2026.',
  )
  // El escolarizado sigue contando en días.
  expect(screen.getByRole('article', { name: 'Periodo escolarizado' }).textContent).toMatch(/días para terminar|comienza en|terminó hace/)
})

test('en modo compacto hay una línea por calendario que aplica', async () => {
  const sabados = { requeridos: 16, total: 16, conClase: 16, transcurridos: 5, sinClases: [], finSugerido: null }
  api.get.mockResolvedValue({ data: respuesta({
    mixto: { ...mixto, fechaInicio: '2026-09-05', fechaFin: '2026-12-19', configurado: true, sabados },
  }) })
  render(<PeriodoEscolarCard compacto />)

  expect(await screen.findByText(/Semestre escolarizado del 31 de agosto al 18 de diciembre de 2026/)).toBeTruthy()
  expect(screen.getByText(/Semestre mixto del 5 de septiembre al 19 de diciembre de 2026/)).toBeTruthy()
  expect(screen.getByText('van 5 de 16 sábados')).toBeTruthy()
})
