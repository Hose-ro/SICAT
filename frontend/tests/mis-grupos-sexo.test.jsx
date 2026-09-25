import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

import api from '../src/api/axios'
import MisGrupos from '../src/pages/docente/MisGrupos'

const grupo = { id: 9, nombre: '103-SA', semestre: 1, periodo: 'AGOSTO-DICIEMBRE', carrera: { nombre: 'ISC' }, _count: { alumnos: 1 } }

const completa = { id: 1, nombre: 'Ana López', numeroControl: '265Q0307', email: 'ana@correo.com', telefono: '9611234567', sexo: 'MUJER' }
const incompleto = { id: 2, nombre: 'Beto Cruz', numeroControl: '265Q0343', email: null, telefono: null, sexo: null }

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

const llamadasAlDetalle = () =>
  api.get.mock.calls.filter(([url]) => url === `/grupos/mis-grupos/${grupo.id}`).length

test('el sexo ya asignado se ve como insignia junto al nombre y se resume en el encabezado', async () => {
  await abrirDetalle([
    completa,
    { ...incompleto, sexo: 'HOMBRE' },
  ])

  expect(screen.getByTitle('Mujer')).toBeTruthy()
  expect(screen.getByTitle('Hombre')).toBeTruthy()
  expect(screen.getByText('1 H · 1 M')).toBeTruthy()
})

test('Editar lista asigna el sexo con un clic sin recargar la lista', async () => {
  const user = await abrirDetalle([incompleto])
  api.patch.mockResolvedValue({ data: { ...incompleto, sexo: 'HOMBRE' } })
  const cargasAntes = llamadasAlDetalle()

  await user.click(screen.getByRole('button', { name: 'Editar lista' }))

  const selector = screen.getByRole('group', { name: 'Sexo de Beto Cruz' })
  await user.click(within(selector).getByRole('button', { name: 'Hombre' }))

  expect(within(selector).getByRole('button', { name: 'Hombre' }).getAttribute('aria-pressed')).toBe('true')
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
    '/grupos/mis-grupos/9/alumnos/2',
    { sexo: 'HOMBRE' },
  ))
  expect(await screen.findByText('Guardado')).toBeTruthy()
  expect(llamadasAlDetalle()).toBe(cargasAntes)
})

test('si el servidor rechaza el sexo se regresa al valor anterior y se explica', async () => {
  const user = await abrirDetalle([incompleto])
  api.patch.mockRejectedValue({ response: { data: { message: 'No se pudo guardar el sexo' } } })

  await user.click(screen.getByRole('button', { name: 'Editar lista' }))
  const selector = screen.getByRole('group', { name: 'Sexo de Beto Cruz' })
  await user.click(within(selector).getByRole('button', { name: 'Mujer' }))

  expect(await screen.findByText('No se pudo guardar el sexo')).toBeTruthy()
  expect(within(selector).getByRole('button', { name: 'Mujer' }).getAttribute('aria-pressed')).toBe('false')
})

test('los datos faltantes se capturan en la lista y Enter los guarda', async () => {
  const user = await abrirDetalle([incompleto])
  api.patch.mockResolvedValue({ data: { ...incompleto, telefono: '9611234567' } })

  await user.click(screen.getByRole('button', { name: 'Editar lista' }))
  await user.type(screen.getByLabelText(/Teléfono/), '961 123 4567{Enter}')

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
    '/grupos/mis-grupos/9/alumnos/2',
    { telefono: '9611234567' },
  ))
  expect(screen.getByLabelText(/Teléfono/).value).toBe('9611234567')
})

test('un número de control mal escrito se señala sin llamar al servidor', async () => {
  const user = await abrirDetalle([{ ...incompleto, numeroControl: null }])

  await user.click(screen.getByRole('button', { name: 'Editar lista' }))
  await user.type(screen.getByLabelText(/No\. de control/), '12345{Enter}')

  expect(await screen.findByText('Usa el formato 225Q0103')).toBeTruthy()
  expect(api.patch).not.toHaveBeenCalled()
})

test('"Completar ahora" abre la edición sólo con los alumnos a los que les falta algo', async () => {
  const user = await abrirDetalle([completa, incompleto])

  await user.click(screen.getByRole('button', { name: 'Completar ahora' }))

  expect(screen.getByRole('group', { name: 'Sexo de Beto Cruz' })).toBeTruthy()
  expect(screen.queryByRole('group', { name: 'Sexo de Ana López' })).toBeNull()
  expect(screen.getByRole('button', { name: /Con datos faltantes/ }).getAttribute('aria-pressed')).toBe('true')
})
