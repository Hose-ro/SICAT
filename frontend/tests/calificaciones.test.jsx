import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
import api from '../src/api/axios'
import Calificaciones from '../src/pages/Calificaciones'
import FeedbackDialogs from '../src/components/FeedbackDialogs'
import { useAuthStore } from '../src/store/authStore'
import { useCalificacionStore } from '../src/store/calificacionStore'
import { useFeedbackStore } from '../src/lib/feedback'

const materia = { id: 410, nombre: 'Programación Lógica', grupos: [{ id: 6, nombre: '8A' }], unidades: [{ id: 1, nombre: 'Unidad 1' }] }
const otraMateria = { id: 411, nombre: 'Redes', grupos: [], unidades: [] }
const virtual = (clave, nombre, tipo, peso) => ({ clave, id: null, nombre, tipo, peso, meta: null, virtual: true })
const predeterminada = (tareas, asistencia) => ({ origen: 'PREDETERMINADA', legado: 'MATERIA', criterios: [virtual('tareas', 'Tareas', 'TAREAS', tareas), virtual('asistencia', 'Asistencia', 'ASISTENCIA', asistencia)] })
const reporte = (tareas, asistencia, rows = [], metrics = {}, extra = {}) => ({ rows, metrics, ponderacion: { tareas, asistencia, categorias: [], origen: 'MATERIA' }, criterios: extra.criterios ?? predeterminada(tareas, asistencia), tareasSinCategoria: extra.tareasSinCategoria ?? 0 })
const vistaCriterios = (base = predeterminada(80, 20)) => ({
 materiaId: 410, grupoId: 6,
 base: { origen: base.origen === 'GRUPO' ? 'GRUPO' : 'PREDETERMINADA', criterios: base.criterios },
 unidades: [{ unidad: { id: 1, nombre: 'Unidad 1', orden: 1, status: 'ACTIVA' }, personalizada: false, criterios: null }],
 catalogo: [], gruposDelDocente: [],
})
const fila = (id, nombre, { manual = null, calculada = null, estado = 'PENDIENTE', unidad = 1 } = {}) => ({
 alumno: { id, nombre, numeroControl: `C${id}` }, materia: { id: 410, nombre: materia.nombre }, grupo: { id: 6, nombre: '8A' },
 unidad: { id: unidad, nombre: `Unidad ${unidad}`, orden: unidad }, calificacionManual: manual, calificacionCalculada: calculada,
 calificacionFinal: manual ?? calculada, observacionManual: null, estado,
 fuenteCalificacion: manual != null ? 'MANUAL' : calculada != null ? 'CALCULADA' : 'PENDIENTE',
})
const renderPage = (url = '/calificaciones') =>
 render(<MemoryRouter initialEntries={[url]}><Calificaciones /><FeedbackDialogs /></MemoryRouter>)
const docenteParams = () => api.get.mock.calls.filter(([url]) => url === '/calificaciones/docente').map(([, config]) => config.params)

function servir({ materias = [materia, otraMateria], rows = [], metrics = {}, pesos = [80, 20], extra = {}, criterios = vistaCriterios() } = {}) {
 api.get.mockImplementation((url) => {
  if (url === '/materias/mis-materias') return Promise.resolve({ data: materias })
  if (url === '/calificaciones/docente') return Promise.resolve({ data: reporte(...pesos, rows, metrics, extra) })
  if (url === '/calificaciones/criterios') return Promise.resolve({ data: criterios })
  return Promise.reject(new Error(`unexpected ${url}`))
 })
}

// jsdom no implementa matchMedia; el ancho se controla con innerWidth.
beforeAll(() => {
 window.matchMedia = (media) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} })
})
afterEach(() => { window.innerWidth = 1024 })

// Con varias unidades a la vista la etiqueta incluye la unidad ("Ana en Unidad 1").
const celda = (nombre) => screen.getByLabelText(new RegExp(`^Calificación de ${nombre}( en |$)`))
const observacion = (nombre) => screen.getByLabelText(new RegExp(`^Observación de ${nombre}( en |$)`))

beforeEach(() => {
 vi.clearAllMocks()
 useAuthStore.setState({ user: { id: 36, rol: 'DOCENTE' } })
 useCalificacionStore.setState({ reporteDocente: null, error: null, loading: false })
 useFeedbackStore.setState({ confirmation: null, notices: [] })
 servir()
})

async function abrirCriterios(user, url = '/calificaciones?materia=410&grupo=6') {
 renderPage(url)
 await user.click(await screen.findByRole('button', { name: 'Editar criterios' }))
 await screen.findByLabelText('Porcentaje de Tareas')
}

test('sin grupo elegido, los criterios piden elegir uno', async () => {
 renderPage('/calificaciones?materia=410')
 expect(await screen.findByText(/Cada grupo tiene sus criterios. Elige un grupo/)).toBeTruthy()
 expect(screen.queryByRole('button', { name: 'Editar criterios' })).toBeNull()
 expect(docenteParams()[0]).toEqual({ materiaId: '410' })
})

test('con un grupo se editan sus criterios y todos suman 100', async () => {
 const user=userEvent.setup()
 servir({ extra: { tareasSinCategoria: 2 } })
 renderPage('/calificaciones?materia=410&grupo=6')
 expect(await screen.findByText(/Predeterminada: Tareas 80 % · Asistencia 20 %/)).toBeTruthy()
 expect(screen.getByText(/2 actividades no tienen un criterio de este grupo/)).toBeTruthy()

 await user.click(screen.getByRole('button', { name: 'Editar criterios' }))
 const tareas = await screen.findByLabelText('Porcentaje de Tareas')
 expect(api.get).toHaveBeenCalledWith('/calificaciones/criterios', { params: { materiaId: '410', grupoId: 6 } })
 expect(screen.getByText(/8A usa la ponderación predeterminada/)).toBeTruthy()
 const guardar = screen.getByRole('button', { name: 'Guardar criterios' })
 expect(guardar.disabled).toBe(true)

 await user.clear(tareas); await user.type(tareas, '50')
 expect(screen.getByText('Suma 70 % · faltan 30 %')).toBeTruthy()
 expect(screen.getByText('Los criterios deben sumar 100 % (ahora suman 70 %).')).toBeTruthy()
 expect(guardar.disabled).toBe(true)

 await user.click(screen.getByRole('button', { name: 'Agregar criterio' }))
 await user.click(await screen.findByRole('menuitem', { name: 'Examen' }))
 const examen = screen.getByLabelText('Porcentaje de Examen')
 expect(examen.value).toBe('30')
 expect(screen.getByText('Suma 100 %')).toBeTruthy()

 const guardado = vistaCriterios({ origen: 'GRUPO', criterios: [
  { clave: 'c1', id: 1, nombre: 'Tareas', tipo: 'TAREAS', peso: 50, meta: null },
  { clave: 'c3', id: 3, nombre: 'Examen', tipo: 'EXAMEN', peso: 30, meta: null },
  { clave: 'c2', id: 2, nombre: 'Asistencia', tipo: 'ASISTENCIA', peso: 20, meta: null },
 ] })
 api.put.mockResolvedValueOnce({ data: { ...guardado, reasignadas: 2 } })
 await user.click(guardar)
 expect(api.put).toHaveBeenCalledWith('/calificaciones/criterios', {
  materiaId: 410, grupoId: 6,
  criterios: [
   { nombre: 'Tareas', tipo: 'TAREAS', peso: 50 },
   { nombre: 'Asistencia', tipo: 'ASISTENCIA', peso: 20 },
   { nombre: 'Examen', tipo: 'EXAMEN', peso: 30 },
  ],
 })
 expect(await screen.findByText(/Criterios de 8A guardados. 2 tareas sin criterio quedaron en «Tareas»./)).toBeTruthy()
 // El reporte se vuelve a pedir para recalcular.
 await waitFor(() => expect(docenteParams().length).toBeGreaterThan(1))
})

test('si el servidor rechaza los criterios se muestra el motivo', async () => {
 const user=userEvent.setup()
 await abrirCriterios(user)
 const tareas = screen.getByLabelText('Porcentaje de Tareas')
 const asistencia = screen.getByLabelText('Porcentaje de Asistencia')
 await user.clear(tareas); await user.type(tareas, '60')
 await user.clear(asistencia); await user.type(asistencia, '40')
 api.put.mockImplementationOnce(() => Promise.reject({ response: { status: 403, data: { message: 'No impartes esta materia' } } }))
 await user.click(screen.getByRole('button', { name: 'Guardar criterios' }))
 expect((await screen.findByText('No impartes esta materia'))).toBeTruthy()
})

async function abrirMateriaConAlumnos(user, rows = [fila(1, 'Ana', { calculada: 82, estado: 'APROBADO' }), fila(2, 'Beto')], metrics = {}) {
 servir({ rows, metrics })
 renderPage()
 await user.selectOptions(await screen.findByLabelText('Materia'), '410')
 await screen.findByLabelText(/^Calificación de Ana/)
}

test('una sola celda: la calculada es la sugerencia y se puede volver a ella', async () => {
 const user=userEvent.setup()
 await abrirMateriaConAlumnos(user, [fila(1, 'Ana', { manual: 90, calculada: 82, estado: 'APROBADO' }), fila(2, 'Beto', { calculada: 64 })])
 const ana = celda('Ana')
 const beto = celda('Beto')
 expect(ana.value).toBe('90')
 expect(screen.getByText('· calculada 82')).toBeTruthy()
 expect(beto.value).toBe('')
 expect(beto.placeholder).toBe('64')

 await user.click(screen.getByRole('button', { name: /^Usar la calificación calculada para Ana/ }))
 expect(ana.value).toBe('')
 expect(ana.placeholder).toBe('82')
 expect(screen.getByText('1 cambio sin guardar')).toBeTruthy()

 api.patch.mockResolvedValueOnce({ data: reporte(80, 20, [fila(1, 'Ana', { calculada: 82 }), fila(2, 'Beto', { calculada: 64 })]) })
 await user.click(screen.getByRole('button', { name: 'Guardar todo' }))
 expect(api.patch).toHaveBeenCalledWith('/calificaciones/manual/lote', {
  materiaId: 410, grupoId: undefined,
  calificaciones: [{ alumnoId: 1, unidadId: 1, calificacionManual: null, observacion: '' }],
 }, { params: {} })
})

test('guardar todo manda un solo lote con lo modificado y conserva lo escrito mientras se guarda', async () => {
 const user=userEvent.setup()
 await abrirMateriaConAlumnos(user)
 await user.type(celda('Ana'), '90')
 await user.type(celda('Beto'), '75')
 expect(screen.getByText('2 cambios sin guardar')).toBeTruthy()

 let responder
 api.patch.mockImplementationOnce(() => new Promise((resolve) => { responder = resolve }))
 await user.click(screen.getByRole('button', { name: 'Guardar todo' }))
 expect(api.patch).toHaveBeenCalledTimes(1)
 expect(api.patch.mock.calls[0][1].calificaciones.map((c) => [c.alumnoId, c.calificacionManual])).toEqual([[1, 90], [2, 75]])
 await user.type(observacion('Beto'), 'Revisar')

 responder({ data: reporte(80, 20, [fila(1, 'Ana', { manual: 90 }), fila(2, 'Beto', { manual: 75 })]) })
 expect((await screen.findByText('Se guardaron 2 calificaciones.'))).toBeTruthy()
 expect(screen.getByText('1 cambio sin guardar')).toBeTruthy()
 expect(celda('Ana').value).toBe('90')
 expect(observacion('Beto').value).toBe('Revisar')
})

test('una calificación fuera de rango se marca en la fila y bloquea el guardado', async () => {
 const user=userEvent.setup()
 await abrirMateriaConAlumnos(user)
 await user.type(celda('Ana'), '150')
 expect(celda('Ana').getAttribute('aria-invalid')).toBe('true')
 expect(screen.getByText('Debe estar entre 1 y 100')).toBeTruthy()
 expect(screen.getByRole('button', { name: 'Guardar todo' }).disabled).toBe(true)
 await user.clear(celda('Ana')); await user.type(celda('Ana'), '95')
 expect(screen.getByRole('button', { name: 'Guardar todo' }).disabled).toBe(false)
})

test('Enter baja al siguiente alumno y Shift+Enter sube', async () => {
 const user=userEvent.setup()
 await abrirMateriaConAlumnos(user)
 await user.click(celda('Ana'))
 await user.keyboard('88{Enter}')
 expect(document.activeElement).toBe(celda('Beto'))
 await user.keyboard('{Shift>}{Enter}{/Shift}')
 expect(document.activeElement).toBe(celda('Ana'))
})

test('buscar, ordenar y filtrar por estado desde las tarjetas', async () => {
 const user=userEvent.setup()
 await abrirMateriaConAlumnos(user, [
  fila(1, 'Ana', { calculada: 82, estado: 'APROBADO' }),
  fila(2, 'Beto', { calculada: 60, estado: 'REQUIERE_ATENCION' }),
  fila(3, 'Álvaro'),
 ], { aprobadas: 1, requiereAtencion: 1, pendientes: 1, totalAlumnos: 3 })
 const nombres = () => screen.getAllByLabelText(/^Calificación de /).map((input) => input.getAttribute('aria-label').replace('Calificación de ', '').replace(/ en .*/, ''))
 expect(screen.getByText('3 alumnos')).toBeTruthy()
 expect(nombres()).toEqual(['Álvaro', 'Ana', 'Beto'])

 await user.selectOptions(screen.getByLabelText('Ordenar por'), 'menor')
 expect(nombres()).toEqual(['Beto', 'Ana', 'Álvaro'])

 await user.type(screen.getByLabelText('Buscar alumno'), 'alvaro')
 expect(nombres()).toEqual(['Álvaro'])
 await user.clear(screen.getByLabelText('Buscar alumno'))

 const tarjeta = screen.getByRole('button', { name: /Requieren atención/ })
 await user.click(tarjeta)
 expect(tarjeta.getAttribute('aria-pressed')).toBe('true')
 expect(nombres()).toEqual(['Beto'])
 await user.click(screen.getByRole('button', { name: /Mostrando: Requieren atención/ }))
 expect(nombres()).toHaveLength(3)
})

test('los filtros se leen de la URL y ocultan las columnas repetidas', async () => {
 servir({ rows: [fila(1, 'Ana')] })
 renderPage('/calificaciones?materia=410&unidad=1')
 await screen.findByLabelText(/^Calificación de Ana/)
 expect(docenteParams()[0]).toEqual({ materiaId: '410', unidadId: '1' })
 expect(screen.getByLabelText('Unidad').value).toBe('1')
 const encabezados = within(screen.getByRole('table')).getAllByRole('columnheader').map((th) => th.textContent)
 expect(encabezados).toContain('Grupo')
 expect(encabezados).not.toContain('Unidad')
 expect(screen.queryByRole('group', { name: 'Vista' })).toBeNull()
})

test('con una sola materia se selecciona sola', async () => {
 servir({ materias: [materia], rows: [fila(1, 'Ana')] })
 renderPage()
 await screen.findByLabelText(/^Calificación de Ana/)
 expect(screen.getByLabelText('Materia').value).toBe('410')
})

test('cambiar el filtro con cambios pendientes pide confirmación', async () => {
 const user=userEvent.setup()
 await abrirMateriaConAlumnos(user)
 await user.type(celda('Ana'), '90')

 await user.selectOptions(screen.getByLabelText('Unidad'), '1')
 expect(await screen.findByText(/Tienes 1 calificación sin guardar/)).toBeTruthy()
 await user.click(screen.getByRole('button', { name: 'Cancelar' }))
 await waitFor(()=>expect(screen.queryByText(/Tienes 1 calificación sin guardar/)).toBeNull())
 expect(screen.getByLabelText('Unidad').value).toBe('')
 expect(celda('Ana').value).toBe('90')

 await user.selectOptions(screen.getByLabelText('Unidad'), '1')
 await user.click(await screen.findByRole('button', { name: 'Descartar cambios' }))
 await waitFor(()=>expect(screen.getByLabelText('Unidad').value).toBe('1'))
 await waitFor(()=>expect(celda('Ana').value).toBe(''))
})

test('si la exportación falla se muestra el motivo', async () => {
 const user=userEvent.setup()
 renderPage()
 expect(screen.getByText('Elige una materia para exportar.')).toBeTruthy()
 await user.selectOptions(await screen.findByLabelText('Materia'), '410')
 api.get.mockImplementationOnce(() => Promise.reject({ response: { data: new Blob([JSON.stringify({ message: 'Sin alumnos para exportar' })]) } }))
 await user.click(screen.getByRole('button', { name: 'Excel' }))
 expect(await screen.findByText('Sin alumnos para exportar')).toBeTruthy()
 expect(screen.getByRole('button', { name: 'Excel' }).disabled).toBe(false)
})

const dosUnidades = () => [
 fila(1, 'Ana', { calculada: 80, estado: 'APROBADO' }), fila(1, 'Ana', { unidad: 2, calculada: 60, estado: 'REQUIERE_ATENCION' }),
 fila(2, 'Beto', { calculada: 90, estado: 'APROBADO' }), fila(2, 'Beto', { unidad: 2 }),
]

test('la vista por alumno muestra una fila por alumno, una columna por unidad y el promedio en vivo', async () => {
 const user=userEvent.setup()
 servir({ rows: dosUnidades() })
 renderPage('/calificaciones?materia=410')
 await screen.findByLabelText('Calificación de Ana en Unidad 1')
 await user.click(within(screen.getByRole('group', { name: 'Vista' })).getByRole('button', { name: 'Por alumno' }))

 const matriz = screen.getByRole('table')
 expect(within(matriz).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Alumno', 'Grupo', 'Unidad 1', 'Unidad 2', 'Promedio'])
 expect(within(matriz).getAllByRole('rowheader').map((th) => th.firstChild.textContent)).toEqual(['Ana', 'Beto'])
 const filaAna = within(matriz).getAllByRole('row')[1]
 expect(within(filaAna).getAllByRole('cell').at(-1).textContent).toBe('70')

 await user.click(screen.getByLabelText('Calificación de Ana en Unidad 2'))
 await user.keyboard('100{Enter}')
 expect(within(filaAna).getAllByRole('cell').at(-1).textContent).toBe('90')
 expect(document.activeElement).toBe(screen.getByLabelText('Calificación de Beto en Unidad 2'))

 api.patch.mockResolvedValueOnce({ data: reporte(80, 20, dosUnidades()) })
 await user.click(screen.getByRole('button', { name: 'Guardar todo' }))
 expect(api.patch.mock.calls[0][1].calificaciones).toEqual([{ alumnoId: 1, unidadId: 2, calificacionManual: 100, observacion: '' }])
})

test('en teléfono cada alumno es una tarjeta en lugar de una fila de tabla', async () => {
 window.innerWidth = 400
 servir({ rows: [fila(1, 'Ana', { calculada: 82, estado: 'APROBADO' })] })
 renderPage('/calificaciones?materia=410&unidad=1')
 const tarjetas = await screen.findByRole('list', { name: 'Lista de calificaciones' })
 expect(screen.queryByRole('table')).toBeNull()
 expect(within(tarjetas).getByText('Ana')).toBeTruthy()
 expect(within(tarjetas).getByLabelText('Calificación de Ana').placeholder).toBe('82')
 expect(within(tarjetas).getByText('Tareas 0/0 · Asistencia 0%')).toBeTruthy()
})
