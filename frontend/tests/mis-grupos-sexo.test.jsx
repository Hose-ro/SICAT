import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

import api from '../src/api/axios'
import MisGrupos from '../src/pages/docente/MisGrupos'

const grupo = { id: 9, nombre: '103-SA', semestre: 1, periodo: 'AGOSTO-DICIEMBRE', carrera: { nombre: 'ISC' }, _count: { alumnos: 1 } }

const detalle = (alumnos) => ({
  ...grupo,
  materias: [],
  alumnos,
})

beforeEach(() => {
  vi.clearAllMocks()
})

async function abrirDetalle(alumnos) {
  api.get.mockImplementation((url) => {
    if (url === '/grupos/mis-grupos') return Promise.resolve({ data: [grupo] })
    if (url === `/grupos/mis-grupos/${grupo.id}`) return Promise.resolve({ data: detalle(alumnos) })
    return Promise.reject(new Error(`URL inesperada: ${url}`))
  })
  const user = userEvent.setup()
  render(<MemoryRouter><MisGrupos /></MemoryRouter>)

  await user.click(await screen.findByRole('button', { name: /Ver alumnos/ }))
  await screen.findByRole('heading', { name: `Grupo ${grupo.nombre}` })
  return user
}

test('el sexo ya asignado se ve como insignia junto al nombre', async () => {
  await abrirDetalle([
    { id: 1, nombre: 'Ana López', numeroControl: '265Q0307', sexo: 'MUJER' },
    { id: 2, nombre: 'Beto Cruz', numeroControl: '265Q0343', sexo: 'HOMBRE' },
  ])

  expect(screen.getByTitle('Mujer')).toBeTruthy()
  expect(screen.getByTitle('Hombre')).toBeTruthy()
})

test('Editar lista reemplaza Editar/Quitar por el selector de sexo y lo guarda con un clic', async () => {
  const user = await abrirDetalle([
    { id: 1, nombre: 'Ana López', numeroControl: '265Q0307', sexo: null },
  ])
  api.patch.mockResolvedValue({ data: { id: 1 } })
  api.get.mockImplementation((url) => {
    if (url === `/grupos/mis-grupos/${grupo.id}`) {
      return Promise.resolve({ data: detalle([{ id: 1, nombre: 'Ana López', numeroControl: '265Q0307', sexo: 'MUJER' }]) })
    }
    return Promise.resolve({ data: [grupo] })
  })

  await user.click(screen.getByRole('button', { name: 'Editar lista' }))
  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Completar datos' })).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Mujer' }))

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
    '/grupos/mis-grupos/9/alumnos/1',
    { sexo: 'MUJER' },
  ))
  expect(await screen.findByTitle('Mujer')).toBeTruthy()
})
