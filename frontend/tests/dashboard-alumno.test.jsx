import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn() } }))
import api from '../src/api/axios'
import DashboardAlumno, { clasesDeHoy, tareasPorHacer } from '../src/pages/alumno/DashboardAlumno'
import { useAuthStore } from '../src/store/authStore'

// Miércoles 16 de septiembre de 2026, 10:30.
const AHORA = new Date(2026, 8, 16, 10, 30)
const enDias = (dias, hora = 23) => new Date(2026, 8, 16 + dias, hora, 59).toISOString()
const tarea = (id, titulo, fechaLimite, extra = {}) => ({
 tarea: { id, titulo, estado: 'PUBLICADA', tieneFechaLimite: Boolean(fechaLimite), fechaLimite, materia: { id: 1, nombre: 'Cálculo' } },
 miEntrega: null, puedeEditarEntrega: true, ...extra,
})

const tareas = [
 tarea(1, 'Ensayo', enDias(3)),
 tarea(2, 'Práctica 1', enDias(0)),
 tarea(3, 'Mapa mental', enDias(-2, 9)),
 tarea(4, 'Reporte', enDias(5), { miEntrega: { estadoRevision: 'INCORRECTA' } }),
 tarea(5, 'Examen', enDias(-5), { miEntrega: { estadoRevision: 'CALIFICADA', calificacion: 95, observacion: 'Excelente trabajo', fechaRevision: enDias(-1) } }),
 tarea(6, 'Ya entregada', enDias(2), { miEntrega: { estadoRevision: 'ENTREGADA' } }),
 tarea(7, 'Cerrada', enDias(-1), { tarea: { id: 7, titulo: 'Cerrada', estado: 'CERRADA' }, puedeEditarEntrega: false }),
]
const horarios = [
 { id: 1, dias: 'Lunes,Miércoles', horaInicio: '10:00', horaFin: '11:00', materia: { nombre: 'Cálculo' }, aula: { nombre: 'Aula 3' }, docente: { nombre: 'Prof. Ruiz' } },
 { id: 2, dias: 'Miercoles', horaInicio: '12:00', horaFin: '13:00', materia: { nombre: 'Redes' } },
 { id: 3, dias: 'Miercoles', horaInicio: '08:00', horaFin: '09:00', materia: { nombre: 'Física' } },
 { id: 4, dias: 'Martes', horaInicio: '09:00', horaFin: '10:00', materia: { nombre: 'Química' } },
]
const asistencias = [
 { materia: { id: 1, nombre: 'Cálculo' }, resumen: { total: 10, faltas: 1, retardos: 0, porcentaje: 90, enRiesgo: false } },
 { materia: { id: 2, nombre: 'Redes' }, resumen: { total: 6, faltas: 2, retardos: 1, porcentaje: 50, enRiesgo: true } },
 { materia: { id: 3, nombre: 'Física' }, resumen: { total: 0, faltas: 0, retardos: 0, porcentaje: 0, enRiesgo: false } },
]
const diasSinClases = [{ fecha: '2026-09-18', motivo: 'Congreso', institucional: false, materias: ['Redes'] }]
const claseActiva = { id: 40, materia: { id: 1, nombre: 'Cálculo' }, docente: { nombre: 'Prof. Ruiz' }, horarioMateria: { aula: { nombre: 'Aula 3' } } }

function servir(fallas = []) {
 const datos = {
  '/tareas/mis-tareas': tareas,
  '/asistencias/mis-resumen': asistencias,
  '/horarios/mis-horarios-alumno': { horarios },
  '/periodos/actual/dias-sin-clases': diasSinClases,
  '/clases/mis-clases-activas': [claseActiva],
 }
 api.get.mockImplementation((url) => (fallas.includes(url) ? Promise.reject(new Error('caído')) : Promise.resolve({ data: datos[url] })))
}

beforeEach(() => {
 vi.clearAllMocks()
 vi.useFakeTimers({ now: AHORA, shouldAdvanceTime: true })
 useAuthStore.setState({ user: { id: 9, nombre: 'Ana Pérez', rol: 'ALUMNO' } })
 servir()
})
afterEach(() => vi.useRealTimers())

test('lo pendiente va primero por urgencia: corregir, atrasadas, hoy y luego por fecha', () => {
 const lista = tareasPorHacer(tareas, AHORA)
 expect(lista.map((t) => [t.tarea.titulo, t.motivo])).toEqual([
  ['Reporte', 'corregir'], ['Mapa mental', 'atrasada'], ['Práctica 1', 'hoy'], ['Ensayo', 'pendiente'],
 ])
})

test('las clases de hoy se ordenan y marcan la que está en curso y la que sigue', () => {
 expect(clasesDeHoy(horarios, AHORA).map((c) => [c.materia.nombre, c.estado])).toEqual([
  ['Física', 'terminada'], ['Cálculo', 'ahora'], ['Redes', 'siguiente'],
 ])
})

test('el inicio resume lo pendiente, avisa la clase en curso y ofrece acciones rápidas', async () => {
 render(<MemoryRouter><DashboardAlumno /></MemoryRouter>)

 expect(await screen.findByText('Tienes 4 tareas pendientes, 1 vence hoy, 1 atrasada, 1 para corregir.')).toBeTruthy()
 expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hola, Ana')
 expect(screen.getByText(/vas en riesgo por faltas en 1 materia/)).toBeTruthy()

 const enCurso = (await screen.findByText('Clase en curso: Cálculo')).closest('a')
 expect(enCurso.getAttribute('role')).toBe('status')
 expect(enCurso.textContent).toContain('Clase en curso: Cálculo')
 expect(enCurso.textContent).toContain('Prof. Ruiz inició la clase · Aula 3')
 expect(enCurso.getAttribute('href')).toBe('/alumno/materias/1')

 const rapidas = within(screen.getByRole('navigation', { name: 'Acciones rápidas' }))
 expect(rapidas.getByRole('link', { name: /Entregar tarea/ }).getAttribute('href')).toBe('/alumno/tareas/4')
 expect(rapidas.getByRole('link', { name: /Mis faltas/ }).textContent).toContain('3 faltas en total')

 const pendientes = within(screen.getByRole('region', { name: 'Tareas pendientes' }))
 expect(pendientes.getByRole('link', { name: 'Corregir Reporte' }).getAttribute('href')).toBe('/alumno/tareas/4')
 expect(pendientes.getByRole('link', { name: 'Entregar Ensayo' })).toBeTruthy()
 expect(pendientes.queryByText('Ya entregada')).toBeNull()

 const faltas = within(screen.getByRole('region', { name: 'Mis faltas' }))
 expect(faltas.getAllByRole('meter').map((m) => m.getAttribute('aria-label'))).toEqual(['Asistencia en Redes', 'Asistencia en Cálculo'])
 expect(faltas.getByText(/en riesgo por faltas y retardos/)).toBeTruthy()

 const calificaciones = within(screen.getByRole('region', { name: 'Calificaciones recientes' }))
 expect(calificaciones.getByText('95')).toBeTruthy()
 expect(calificaciones.getByText('“Excelente trabajo”')).toBeTruthy()

 const dias = within(screen.getByRole('region', { name: 'Próximos días sin clases' }))
 expect(dias.getByText('Congreso · sin Redes')).toBeTruthy()
})

test('si una sección falla, las demás se siguen viendo', async () => {
 servir(['/asistencias/mis-resumen'])
 render(<MemoryRouter><DashboardAlumno /></MemoryRouter>)
 expect(await screen.findByText('No se pudieron cargar tus asistencias.')).toBeTruthy()
 expect(within(screen.getByRole('region', { name: 'Tareas pendientes' })).getByText('Ensayo')).toBeTruthy()
})
