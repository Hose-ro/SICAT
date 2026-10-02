import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
import api from '../src/api/axios'
import ActivarCuenta from '../src/pages/ActivarCuenta'
import ModalCodigosActivacion from '../src/pages/admin/grupos/components/ModalCodigosActivacion'
import { useAuthStore } from '../src/store/authStore'

beforeEach(() => {
 vi.clearAllMocks()
 useAuthStore.setState({ user: null })
})

function renderActivar() {
 return render(
  <MemoryRouter initialEntries={['/activar']}>
   <Routes>
    <Route path="/activar" element={<ActivarCuenta />} />
    <Route path="/dashboard" element={<p>Inicio del alumno</p>} />
   </Routes>
  </MemoryRouter>,
 )
}

async function llenar(user, { control = '225q0103', codigo = 'k7p2-m9qx', password = 'clave-nueva', confirmacion = password } = {}) {
 await user.type(screen.getByLabelText('Número de control'), control)
 await user.type(screen.getByLabelText('Código de activación'), codigo)
 await user.type(screen.getByLabelText('Nueva contraseña'), password)
 await user.type(screen.getByLabelText('Confirmar contraseña'), confirmacion)
 await user.click(screen.getByRole('button', { name: 'Activar mi cuenta' }))
}

test('activa la cuenta y entra directo a su inicio', async () => {
 const user = userEvent.setup()
 api.post.mockImplementation((url) => Promise.resolve({
  data: url === '/auth/login' ? { user: { id: 31, rol: 'ALUMNO', nombre: 'Luis' } } : { activada: true },
 }))
 renderActivar()
 await llenar(user)

 expect(await screen.findByText('Inicio del alumno')).toBeTruthy()
 expect(api.post).toHaveBeenNthCalledWith(1, '/auth/activar', { numeroControl: '225Q0103', codigo: 'k7p2-m9qx', password: 'clave-nueva' })
 expect(api.post).toHaveBeenNthCalledWith(2, '/auth/login', { identifier: '225Q0103', password: 'clave-nueva' })
 expect(useAuthStore.getState().user).toEqual(expect.objectContaining({ id: 31 }))
})

test('si las contraseñas no coinciden no envía nada', async () => {
 const user = userEvent.setup()
 renderActivar()
 await llenar(user, { confirmacion: 'otra-clave' })
 expect(screen.getByRole('alert').textContent).toBe('Las contraseñas no coinciden')
 expect(api.post).not.toHaveBeenCalled()
})

test('muestra el motivo cuando el código no sirve', async () => {
 const user = userEvent.setup()
 api.post.mockRejectedValueOnce({ response: { data: { message: 'El número de control o el código no son válidos' } } })
 renderActivar()
 await llenar(user)
 expect((await screen.findByRole('alert')).textContent).toBe('El número de control o el código no son válidos')
})

test('el admin genera los códigos de quienes no han activado y los ve una sola vez', async () => {
 const user = userEvent.setup()
 const grupo = { id: 4, nombre: '806A', alumnos: [{ id: 11, activadoAt: null }, { id: 12, activadoAt: '2026-09-01' }] }
 api.post.mockResolvedValueOnce({ data: {
  vigenciaDias: 180,
  alumnos: [{ id: 11, nombre: 'Ana López', numeroControl: '225Q0103', codigo: 'K7P2-M9QX' }],
 } })
 render(<ModalCodigosActivacion grupo={grupo} onClose={() => {}} />)

 expect(screen.getByLabelText(/Sólo quienes no han activado \(1\)/).checked).toBe(true)
 await user.click(screen.getByRole('button', { name: 'Generar códigos' }))

 await waitFor(() => expect(api.post).toHaveBeenCalledWith('/grupos/4/codigos-activacion', { todos: false }))
 const tabla = within(await screen.findByRole('region', { name: 'Códigos generados' }))
 expect(tabla.getByText('K7P2-M9QX')).toBeTruthy()
 expect(screen.getByRole('status').textContent).toContain('ya no se pueden volver a ver')
})
