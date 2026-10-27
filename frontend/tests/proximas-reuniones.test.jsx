import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn() } }))

import api from '../src/api/axios'
import ProximasReuniones from '../src/pages/docente/components/ProximasReuniones'
import { hoyClaveLocal } from '../src/lib/reuniones'

const pad = (n) => String(n).padStart(2, '0')
const enDias = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const reunion = (id, fecha, extra = {}) => ({
  id, fecha, titulo: `Reunión ${id}`, horaInicio: '12:00', horaFin: '13:00',
  estado: 'PROGRAMADA', modalidad: 'PRESENCIAL', lugar: 'Sala B', tipo: 'ORDINARIA', choques: [], ...extra,
})

beforeEach(() => vi.clearAllMocks())

test('destaca la siguiente reunión y lista las demás en orden', async () => {
  api.get.mockResolvedValue({ data: [
    reunion(2, enDias(7)),
    reunion(1, hoyClaveLocal(), { carrera: { nombre: 'Sistemas' } }),
    reunion(3, enDias(-3)),
    reunion(4, enDias(2), { estado: 'CANCELADA' }),
  ] })
  render(<MemoryRouter><ProximasReuniones /></MemoryRouter>)

  expect(await screen.findByRole('heading', { name: 'Reunión 1' })).toBeTruthy()
  expect(screen.getByText('Hoy')).toBeTruthy()
  expect(screen.getByText('Sala B · Ordinaria · Sistemas')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Ver reunión/ }).getAttribute('href')).toBe('/docente/reuniones?reunion=1')
  expect(screen.getByText('Reunión 2')).toBeTruthy()
  expect(screen.queryByText('Reunión 3')).toBeNull()
  expect(screen.queryByText('Reunión 4')).toBeNull()
})

test('sin reuniones próximas muestra el panel vacío en lugar de desaparecer', async () => {
  api.get.mockResolvedValue({ data: [] })
  render(<MemoryRouter><ProximasReuniones /></MemoryRouter>)
  expect(await screen.findByText('No tienes reuniones de academia próximas')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Reuniones de academia' })).toBeTruthy()
})
