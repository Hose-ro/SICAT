import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))
import api from '../src/api/axios'
import SolicitudesPendientes from '../src/pages/docente/SolicitudesPendientes'
import { useInscripcionStore } from '../src/store/inscripcionStore'

const fail = (status, message) => Promise.reject({ response: { status, data: { message } } })
const solicitud = { id: 7, alumno: { nombre: 'Ana Ramírez' }, materia: { nombre: 'Álgebra' }, periodo: '2026-B', createdAt: '2026-09-01T12:00:00Z' }

beforeEach(() => { vi.clearAllMocks(); useInscripcionStore.setState({ pendientesDocente: [], error: null, loading: false }) })

test('un fallo del servidor se muestra como error con reintento, no como "sin solicitudes"', async () => {
 const user=userEvent.setup()
 api.get.mockImplementationOnce(() => fail(500, 'Error interno')).mockResolvedValueOnce({ data: [solicitud] })
 render(<SolicitudesPendientes />)
 const alert=await screen.findByRole('alert')
 expect(alert.textContent).toContain('Error interno')
 expect(screen.queryByText('No hay solicitudes pendientes')).toBeNull()
 await user.click(screen.getByRole('button',{name:'Volver a intentar'}))
 expect(await screen.findByText('Ana Ramírez')).toBeTruthy()
 expect(screen.queryByRole('alert')).toBeNull()
})

test('sin respuesta del servicio se usa un mensaje genérico', async () => {
 api.get.mockImplementationOnce(() => Promise.reject(new Error('Network Error')))
 render(<SolicitudesPendientes />)
 expect((await screen.findByRole('alert')).textContent).toContain('No se pudieron cargar las solicitudes')
})

test('la lista vacía real sigue mostrando el estado vacío', async () => {
 api.get.mockResolvedValueOnce({ data: [] })
 render(<SolicitudesPendientes />)
 expect(await screen.findByText('No hay solicitudes pendientes')).toBeTruthy()
})

test('aceptar o rechazar con error conserva la solicitud y avisa al docente', async () => {
 const user=userEvent.setup()
 api.get.mockResolvedValueOnce({ data: [solicitud] })
 api.patch.mockImplementationOnce(() => fail(409, 'La solicitud ya fue atendida'))
 render(<SolicitudesPendientes />)
 await user.click(await screen.findByRole('button',{name:'Aceptar'}))
 expect((await screen.findByRole('alert')).textContent).toContain('La solicitud ya fue atendida')
 expect(screen.getByText('Ana Ramírez')).toBeTruthy()
 await waitFor(()=>expect(screen.getByRole('button',{name:'Aceptar'}).disabled).toBe(false))
})
