import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
import api from '../src/api/axios'
import CapturaCalificaciones from '../src/pages/docente/components/tareas/CapturaCalificaciones'
import FeedbackDialogs from '../src/components/FeedbackDialogs'
import { useFeedbackStore } from '../src/lib/feedback'

const tarea = { id: 50, titulo: 'Examen parcial 1', estado: 'PUBLICADA', tipoEntrega: 'PRESENCIAL', categoria: { tipo: 'EXAMEN' } }
const fila = (id, nombre, entrega = null) => ({
  alumno: { id, nombre, numeroControl: `C${id}` },
  entrega: entrega ? { id: 100 + id, alumno: { id }, esSintetica: false, ...entrega } : { id: `sin-entrega-${id}`, esSintetica: true, estadoRevision: 'PENDIENTE' },
  estado: entrega ? (entrega.estadoRevision === 'CALIFICADA' ? 'CALIFICADA' : entrega.estadoRevision) : 'PENDIENTE',
})
const filas = [
  fila(1, 'Ana'),
  fila(2, 'Beto', { estadoRevision: 'CALIFICADA', calificacion: 80, observacion: null }),
  fila(3, 'Carla', { estadoRevision: 'NO_ENTREGADA', calificacion: 0, observacion: null }),
]
const renderCaptura = (props = {}) => render(
  <MemoryRouter>
    <CapturaCalificaciones tarea={tarea} filas={filas} onGuardado={() => {}} {...props} />
    <FeedbackDialogs />
  </MemoryRouter>,
)

beforeEach(() => {
  vi.clearAllMocks()
  useFeedbackStore.setState({ confirmation: null, notices: [] })
})

test('muestra lo guardado: la calificación, el "no presentó" con 0 y el avance', () => {
  renderCaptura()
  expect(screen.getByLabelText('Calificación de Beto').value).toBe('80')
  expect(screen.getByLabelText('Carla no presentó').checked).toBe(true)
  expect(screen.getByLabelText('Calificación de Carla').value).toBe('0')
  expect(screen.getByLabelText('Calificación de Carla').disabled).toBe(true)
  expect(screen.getByText('2 de 3').textContent).toBe('2 de 3')
  // El encabezado de la columna y el estado de Carla.
  expect(screen.getAllByText('No presentó')).toHaveLength(2)
  expect(screen.getByText('Sin calificar')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Guardar calificaciones/ }).disabled).toBe(true)
})

test('Enter baja al siguiente alumno que se puede calificar', async () => {
  const user = userEvent.setup()
  renderCaptura()
  await user.click(screen.getByLabelText('Calificación de Ana'))
  await user.keyboard('95{Enter}')
  expect(document.activeElement).toBe(screen.getByLabelText('Calificación de Beto'))
  await user.keyboard('{Shift>}{Enter}{/Shift}')
  expect(document.activeElement).toBe(screen.getByLabelText('Calificación de Ana'))
})

test('sólo manda lo que cambió y bloquea calificaciones fuera de rango', async () => {
  const user = userEvent.setup()
  const onGuardado = vi.fn()
  renderCaptura({ onGuardado })

  await user.type(screen.getByLabelText('Calificación de Ana'), '150')
  expect(screen.getByLabelText('Calificación de Ana').getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByText(/corrige 1 calificación fuera de 1 a 100/)).toBeTruthy()
  expect(screen.getByRole('button', { name: /Guardar calificaciones/ }).disabled).toBe(true)

  await user.clear(screen.getByLabelText('Calificación de Ana'))
  await user.type(screen.getByLabelText('Calificación de Ana'), '95')
  await user.click(screen.getByLabelText('Beto no presentó'))
  await user.click(screen.getByLabelText('Carla no presentó'))
  await user.type(screen.getByLabelText('Observación para Carla'), 'Presentó en otra fecha')
  await user.type(screen.getByLabelText('Calificación de Carla'), '70')

  api.put.mockResolvedValueOnce({ data: { tarea, entregas: [] } })
  await user.click(screen.getByRole('button', { name: 'Guardar calificaciones (3)' }))
  expect(api.put).toHaveBeenCalledWith('/tareas/50/calificaciones', {
    calificaciones: [
      { alumnoId: 1, calificacion: 95 },
      { alumnoId: 2, noPresento: true },
      { alumnoId: 3, calificacion: 70, observacion: 'Presentó en otra fecha' },
    ],
  })
  expect(onGuardado).toHaveBeenCalledWith({ tarea, entregas: [] })
  expect(await screen.findByText('Se guardaron 3 calificaciones.')).toBeTruthy()
})

test('un borrador no se califica', () => {
  renderCaptura({ tarea: { ...tarea, estado: 'BORRADOR' } })
  expect(screen.getByText('Publica la actividad para capturar sus calificaciones.')).toBeTruthy()
  expect(screen.queryByRole('table')).toBeNull()
})
