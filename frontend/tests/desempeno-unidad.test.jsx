import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn() } }))
import api from '../src/api/axios'
import DesempenoUnidad from '../src/pages/docente/components/DesempenoUnidad'

const materias = [
  { id: 7, nombre: 'Redes', grupo: { id: 3, nombre: '8A' } },
  { id: 9, nombre: 'Compiladores', grupo: { id: 4, nombre: '7B' } },
  { id: 12, nombre: 'Sin grupo', grupo: null },
]
const alumno = (id, nombre, calificacion, desempeno, motivos = [], asistencia = { porcentaje: 90, registradas: 10, faltas: 1, retardos: 0 }) => ({
  alumno: { id, nombre, numeroControl: `C${id}` },
  calificacion,
  calculada: calificacion,
  fuente: 'CALCULADA',
  asistencia,
  participacion: 3,
  criterios: [
    { clave: 'c1', valor: calificacion, calificadas: 1, total: 2 },
    { clave: 'c2', valor: 60, calificadas: 4, total: 5, puntos: 3 },
    { clave: 'c3', valor: asistencia.porcentaje, calificadas: 10, total: 12 },
  ],
  desempeno,
  motivos,
})
const datos = (extra = {}) => ({
  materia: { id: 7, nombre: 'Redes' },
  grupo: { id: 3, nombre: '8A' },
  unidad: { id: 11, nombre: 'Unidad 2', orden: 2, status: 'ACTIVA' },
  unidades: [
    { id: 10, nombre: 'Unidad 1', orden: 1, status: 'FINALIZADA' },
    { id: 11, nombre: 'Unidad 2', orden: 2, status: 'ACTIVA' },
  ],
  criterios: [
    { clave: 'c1', id: 1, nombre: 'Examen', tipo: 'EXAMEN', peso: 50, meta: null },
    { clave: 'c2', id: 2, nombre: 'Participación', tipo: 'PARTICIPACION', peso: 10, meta: 5 },
    { clave: 'c3', id: 3, nombre: 'Asistencia', tipo: 'ASISTENCIA', peso: 40, meta: null },
  ],
  origenCriterios: 'GRUPO',
  umbrales: { aprobatoria: 70, sinRiesgo: 80 },
  resumen: { total: 3, aprobados: 1, enRiesgo: 1, reprobados: 1, sinCalificar: 0 },
  actividadesSinCriterio: 0,
  alumnos: [
    alumno(1, 'Ana', 92, 'APROBADO'),
    alumno(2, 'Beto', 58, 'REPROBADO', ['CALIFICACION_BAJA', 'ASISTENCIA'], { porcentaje: 60, registradas: 10, faltas: 3, retardos: 1 }),
    alumno(3, 'Carla', 76, 'EN_RIESGO', ['CALIFICACION_LIMITE']),
  ],
  ...extra,
})
const pedidos = () => api.get.mock.calls.filter(([url]) => url === '/calificaciones/desempeno').map(([, config]) => config.params)
const renderPanel = (props = {}) => render(
  <MemoryRouter><DesempenoUnidad materias={materias} userId={36} {...props} /></MemoryRouter>,
)

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  window.innerWidth = 1024
  api.get.mockResolvedValue({ data: datos() })
})

test('abre en la clase en curso y ordena primero lo que pide atención', async () => {
  renderPanel({ claseActual: { materiaId: 9, grupoId: 4 } })
  const tabla = await screen.findByRole('table')
  expect(pedidos()[0]).toEqual({ materiaId: 9, grupoId: 4 })
  expect(screen.getByLabelText('Clase').value).toBe('9:4')
  // La materia sin grupo no es una clase con semáforo.
  expect(within(screen.getByLabelText('Clase')).queryByText(/Sin grupo/)).toBeNull()

  const encabezados = within(tabla).getAllByRole('columnheader').map((th) => th.textContent)
  expect(encabezados).toEqual(['Alumno', 'Promedio', 'Asistencia40 %', 'Examen50 %', 'Participación10 %', 'Estado'])
  const filas = within(tabla).getAllByRole('rowheader').map((th) => th.textContent)
  expect(filas).toEqual(['BetoC2', 'CarlaC3', 'AnaC1'])
  expect(screen.getByText('Promedio menor a 70 · 40 % de faltas y retardos')).toBeTruthy()
  expect(screen.getAllByText('3 de 5 pts')).toHaveLength(3)
  expect(screen.getByText('Unidad 2', { selector: 'span.font-medium' }).parentElement.textContent).toContain('Unidad 2 · en curso · Examen 50 %')
})

test('el filtro por estado deja sólo esa fila y la unidad se cambia con el selector', async () => {
  const user = userEvent.setup()
  renderPanel()
  await screen.findByRole('table')
  expect(pedidos()[0]).toEqual({ materiaId: 7, grupoId: 3 })

  await user.click(screen.getByRole('radio', { name: /En riesgo/ }))
  expect(within(screen.getByRole('table')).getAllByRole('rowheader').map((th) => th.textContent)).toEqual(['CarlaC3'])

  await user.click(screen.getByRole('radio', { name: /U1/ }))
  expect(pedidos().at(-1)).toEqual({ materiaId: 7, grupoId: 3, unidadId: 10 })
})

test('recuerda la clase elegida en este navegador', async () => {
  const user = userEvent.setup()
  const { unmount } = renderPanel()
  await screen.findByRole('table')
  await user.selectOptions(screen.getByLabelText('Clase'), '9:4')
  expect(window.localStorage.getItem('sicat.desempeno.clase.36')).toBe('9:4')
  unmount()

  renderPanel()
  await screen.findByRole('table')
  expect(screen.getByLabelText('Clase').value).toBe('9:4')
})

test('una respuesta que no es un reporte muestra el estado vacío, y un error se puede reintentar', async () => {
  api.get.mockResolvedValueOnce({ data: [] })
  const { unmount } = renderPanel()
  expect(await screen.findByText('No hay datos de desempeño para esta clase.')).toBeTruthy()
  unmount()

  const user = userEvent.setup()
  api.get.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Falló el servidor' } } })
  renderPanel()
  expect((await screen.findByRole('alert')).textContent).toContain('Falló el servidor')
  await user.click(screen.getByRole('button', { name: 'Volver a intentar' }))
  expect(await screen.findByRole('table')).toBeTruthy()
})

test('ocultar calificaciones esconde la tabla y se recuerda', async () => {
  const user = userEvent.setup()
  renderPanel()
  await screen.findByRole('table')
  await user.click(screen.getByRole('button', { name: 'Ocultar calificaciones' }))
  expect(screen.queryByRole('table')).toBeNull()
  expect(screen.getByText(/Calificaciones ocultas/)).toBeTruthy()
  expect(window.localStorage.getItem('sicat.desempeno.ocultar')).toBe('1')
})

test('sin clases con grupo no se muestra el panel', () => {
  const { container } = renderPanel({ materias: [{ id: 12, nombre: 'Sin grupo', grupo: null }] })
  expect(container.textContent).toBe('')
  expect(api.get).not.toHaveBeenCalled()
})
