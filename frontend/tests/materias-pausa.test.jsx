import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
import api from '../src/api/axios'
import Materias from '../src/pages/Materias'
import FeedbackDialogs from '../src/components/FeedbackDialogs'
import { useAuthStore } from '../src/store/authStore'
import { useFeedbackStore } from '../src/lib/feedback'

const calculo = { id: 7, nombre: 'Cálculo Diferencial', clave: 'ACF-2301', pausada: false, _count: { inscripciones: 30 } }
const redes = { id: 8, nombre: 'Redes', clave: 'RED-1', pausada: true, _count: { inscripciones: 20 } }
const algebra = { id: 9, nombre: 'Álgebra', clave: 'ALG-1', pausada: false, _count: { inscripciones: 25 } }

function servir(materias) {
 api.get.mockImplementation((url) => {
  if (url === '/carreras') return Promise.resolve({ data: [] })
  if (url.startsWith('/materias')) return Promise.resolve({ data: materias })
  return Promise.reject(new Error(`unexpected ${url}`))
 })
}
const renderPage = () => render(<MemoryRouter><Materias /><FeedbackDialogs /></MemoryRouter>)
const tarjeta = (nombre) => screen.getByRole('link', { name: nombre }).closest('.rounded-2xl')

beforeEach(() => {
 vi.clearAllMocks()
 useFeedbackStore.setState({ confirmation: null, notices: [] })
 useAuthStore.setState({ user: { id: 5, rol: 'DOCENTE' } })
 servir([redes, calculo, algebra])
})

test('el docente pide también sus materias pausadas y las ve al final, marcadas', async () => {
 renderPage()
 await screen.findByRole('link', { name: 'Redes' })
 expect(api.get).toHaveBeenCalledWith('/materias/mis-materias', { params: { incluirPausadas: true } })
 const nombres = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
 expect(nombres.at(-1)).toBe('Redes')
 expect(within(tarjeta('Redes')).getByText('Pausada')).toBeTruthy()
 expect(within(tarjeta('Redes')).getByRole('button', { name: 'Reanudar Redes' })).toBeTruthy()
})

test('Pausar está debajo de Editar y Eliminar, confirma y llama al servidor', async () => {
 const user = userEvent.setup()
 renderPage()
 await screen.findByRole('link', { name: 'Cálculo Diferencial' })
 const botones = within(tarjeta('Cálculo Diferencial')).getAllByRole('button').map((b) => b.textContent)
 expect(botones).toEqual(['Editar', 'Eliminar', 'Pausar'])

 api.put.mockResolvedValueOnce({ data: { materiaId: 7, pausada: true } })
 await user.click(screen.getByRole('button', { name: 'Pausar Cálculo Diferencial' }))
 expect(await screen.findByText(/No se borra nada/)).toBeTruthy()
 expect(api.put).not.toHaveBeenCalled()
 await user.click(screen.getByRole('button', { name: 'Pausar materia' }))

 await waitFor(() => expect(api.put).toHaveBeenCalledWith('/materias/7/pausa'))
 expect(await screen.findByText('Cálculo Diferencial quedó pausada.')).toBeTruthy()
 expect(within(tarjeta('Cálculo Diferencial')).getByText('Pausada')).toBeTruthy()
})

test('cancelar la confirmación no pausa nada', async () => {
 const user = userEvent.setup()
 renderPage()
 await user.click(await screen.findByRole('button', { name: 'Pausar Álgebra' }))
 await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
 expect(api.put).not.toHaveBeenCalled()
 expect(within(tarjeta('Álgebra')).queryByText('Pausada')).toBeNull()
})

test('reanudar no pide confirmación', async () => {
 const user = userEvent.setup()
 api.delete.mockResolvedValueOnce({ data: { materiaId: 8, pausada: false } })
 renderPage()
 await user.click(await screen.findByRole('button', { name: 'Reanudar Redes' }))
 await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/materias/8/pausa'))
 expect(await screen.findByText('Redes se reanudó.')).toBeTruthy()
 expect(within(tarjeta('Redes')).getByRole('button', { name: 'Pausar Redes' })).toBeTruthy()
})

test('el admin no ve el botón de pausar', async () => {
 useAuthStore.setState({ user: { id: 1, rol: 'ADMIN' } })
 renderPage()
 await screen.findByRole('link', { name: 'Cálculo Diferencial' })
 expect(screen.queryByRole('button', { name: /^Pausar / })).toBeNull()
 expect(api.get).toHaveBeenCalledWith('/materias', { params: undefined })
})
