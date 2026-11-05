import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('xlsx', async (importOriginal) => ({ ...(await importOriginal()), writeFile: vi.fn() }))
vi.mock('@/lib/codigosActivacionPdf', async (importOriginal) => ({
 ...(await importOriginal()),
 generarCodigosActivacionPdf: vi.fn(() => Promise.resolve()),
}))
import api from '../src/api/axios'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { crearCodigosActivacionPdf, generarCodigosActivacionPdf } from '../src/lib/codigosActivacionPdf'
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

 await user.click(screen.getByRole('button', { name: 'Descargar Excel' }))
 await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalled())
 const [libro, nombre] = XLSX.writeFile.mock.calls[0]
 expect(nombre).toBe('codigos-activacion-806a.xlsx')
 expect(XLSX.utils.sheet_to_json(libro.Sheets['Códigos'], { header: 1 })).toEqual([
  ['Número de control', 'Nombre', 'Código de activación'],
  ['225Q0103', 'Ana López', 'K7P2-M9QX'],
 ])

 await user.click(screen.getByRole('button', { name: 'Descargar PDF' }))
 expect(generarCodigosActivacionPdf).toHaveBeenCalledWith(expect.objectContaining({
  grupo,
  vigenciaDias: 180,
  nombreArchivo: 'codigos-activacion-806a',
  alumnos: [expect.objectContaining({ codigo: 'K7P2-M9QX' })],
 }))
})

test('el PDF lleva una tarjeta por alumno y pasa de página cuando no caben', () => {
 const alumnos = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  nombre: `Alumno ${i + 1}`,
  numeroControl: `225Q${String(i).padStart(4, '0')}`,
  codigo: `AAAA-${String(i).padStart(4, '0')}`,
 }))
 const doc = crearCodigosActivacionPdf(jsPDF, { grupo: { nombre: '806A' }, alumnos, vigenciaDias: 180 }, null)
 const contenido = doc.internal.pages.flat().filter(Boolean).join('\n')

 expect(doc.getNumberOfPages()).toBeGreaterThan(1)
 expect(contenido).toContain('AAAA-0000')
 expect(contenido).toContain('AAAA-0019')
 expect(contenido).toContain('Grupo 806A')
})
