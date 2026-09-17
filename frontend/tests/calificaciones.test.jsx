import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))
import api from '../src/api/axios'
import Calificaciones from '../src/pages/Calificaciones'
import { useAuthStore } from '../src/store/authStore'
import { useCalificacionStore } from '../src/store/calificacionStore'

const materia = { id: 410, nombre: 'Programación Lógica', grupos: [{ id: 6, nombre: '8A' }], unidades: [{ id: 1, nombre: 'Unidad 1' }] }
const reporte = (tareas, asistencia) => ({ rows: [], metrics: {}, ponderacion: { tareas, asistencia } })

beforeEach(() => {
 vi.clearAllMocks()
 useAuthStore.setState({ user: { id: 36, rol: 'DOCENTE' } })
 useCalificacionStore.setState({ reporteDocente: null, error: null, loading: false })
 api.get.mockImplementation((url) => {
  if (url === '/materias/mis-materias') return Promise.resolve({ data: [materia] })
  if (url === '/calificaciones/docente') return Promise.resolve({ data: reporte(80, 20) })
  return Promise.reject(new Error(`unexpected ${url}`))
 })
})

test('la ponderación viene del servidor y se guarda por materia; las consultas ya no la mandan', async () => {
 const user=userEvent.setup()
 render(<Calificaciones />)
 const guardar=screen.getByRole('button',{name:'Guardar ponderación'})
 expect(guardar.disabled).toBe(true)
 await user.selectOptions(await screen.findByLabelText('Materia'), '410')
 await waitFor(()=>expect(screen.getByLabelText('Tareas %').value).toBe('80'))
 expect(screen.getByLabelText('Asistencia %').value).toBe('20')
 expect(api.get.mock.calls.find(([url])=>url==='/calificaciones/docente')[1].params).toEqual({ materiaId: '410' })

 await user.clear(screen.getByLabelText('Tareas %')); await user.type(screen.getByLabelText('Tareas %'), '70')
 expect(guardar.disabled).toBe(true)
 expect(screen.getByRole('alert').textContent).toContain('sumar 100')
 await user.clear(screen.getByLabelText('Asistencia %')); await user.type(screen.getByLabelText('Asistencia %'), '30')
 expect(screen.queryByRole('alert')).toBeNull()
 expect(guardar.disabled).toBe(false)

 api.patch.mockResolvedValueOnce({ data: { tareas: 70, asistencia: 30 } })
 api.get.mockImplementation((url) => Promise.resolve({ data: url === '/materias/mis-materias' ? [materia] : reporte(70, 30) }))
 await user.click(guardar)
 expect(api.patch).toHaveBeenCalledWith('/calificaciones/ponderacion', { materiaId: 410, pesoTareas: 70, pesoAsistencia: 30 })
 expect((await screen.findByRole('status')).textContent).toContain('Ponderación guardada')
 await waitFor(()=>expect(guardar.disabled).toBe(true))
})

test('si el servidor rechaza la ponderación se muestra el motivo', async () => {
 const user=userEvent.setup()
 render(<Calificaciones />)
 await user.selectOptions(await screen.findByLabelText('Materia'), '410')
 await waitFor(()=>expect(screen.getByLabelText('Tareas %').value).toBe('80'))
 await user.clear(screen.getByLabelText('Tareas %')); await user.type(screen.getByLabelText('Tareas %'), '60')
 await user.clear(screen.getByLabelText('Asistencia %')); await user.type(screen.getByLabelText('Asistencia %'), '40')
 api.patch.mockImplementationOnce(() => Promise.reject({ response: { status: 403, data: { message: 'No impartes esta materia' } } }))
 await user.click(screen.getByRole('button',{name:'Guardar ponderación'}))
 expect((await screen.findByText('No impartes esta materia'))).toBeTruthy()
})
