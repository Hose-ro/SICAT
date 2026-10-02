import { test, expect } from '@playwright/test'
import { mockApi, materia } from './fixtures'

const grupoA = { id: 1, nombre: '101A' }
const grupoB = { id: 2, nombre: '101-SA' }
const fila = (grupo, extra) => ({
  id: 1, nombre: 'Matemáticas', clave: 'MAT-1', grupo, alumnos: 1, unidadActiva: null,
  porcentajeAsistencia: null, entregasSinCalificar: 0, alumnosEnRiesgo: 0, ...extra,
})
const inscripcion = (id, nombre, grupo) => ({
  id, alumnoId: id, grupoId: grupo.id, estado: 'ACEPTADA',
  alumno: { id, nombre, email: `a${id}@test.mx`, numeroControl: `22${id}`, sexo: null },
})

test('la misma materia en dos grupos se abre por grupo, sin revolver alumnos', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/dashboard/docente', (route) => route.fulfill({ json: {
    clasesHoy: [], claseActual: null, proximaClase: null, proximasSuspensiones: [],
    resumen: { materias: 1, clasesHoy: 0, listasPendientes: 0 },
    pendientes: { entregasSinCalificar: 0, alumnosEnRiesgo: 3, solicitudes: 0 },
    materias: [fila(grupoA, { porcentajeAsistencia: 92 }), fila(grupoB, { porcentajeAsistencia: 81, alumnosEnRiesgo: 3 })],
  } }))
  await page.route('**/api/materias/1', (route) => route.fulfill({ json: {
    ...materia, grupos: [grupoB, grupoA], docente: { id: 2, nombre: 'Docente de prueba' },
    inscripciones: [inscripcion(10, 'Ana del Grupo A', grupoA), inscripcion(20, 'Beto del Sabatino', grupoB)],
  } }))
  await page.route('**/api/tareas/materia/1', (route) => route.fulfill({ json: [
    { id: 1, titulo: 'Tarea de 101A', grupoId: 1, tieneFechaLimite: false },
    { id: 2, titulo: 'Tarea del sabatino', grupoId: 2, tieneFechaLimite: false },
    { id: 3, titulo: 'Tarea para todos', grupoId: null, tieneFechaLimite: false },
  ] }))
  const historial = []
  await page.route('**/api/asistencias/historial**', (route) => {
    historial.push(new URL(route.request().url()).searchParams.get('grupoId'))
    return route.fulfill({ json: { items: [], estadisticas: null } })
  })
  await page.route('**/api/avisos**', (route) => route.fulfill({ json: [] }))

  await page.goto('/dashboard')
  const filaA = page.getByRole('link', { name: /Matemáticas · 101A/ })
  const filaB = page.getByRole('link', { name: /Matemáticas · 101-SA/ })
  await expect(filaA).toContainText('92% asistencia')
  await expect(filaB).toContainText('3 en riesgo')
  await expect(page.getByRole('heading', { name: /Mis materias/ })).toContainText('2')

  await filaB.click()
  await expect(page).toHaveURL(/\/materias\/1\?grupo=2$/)
  await expect(page.getByRole('heading', { name: 'Matemáticas · 101-SA' })).toBeVisible()
  await expect(page.getByText('Beto del Sabatino')).toBeVisible()
  await expect(page.getByText('Ana del Grupo A')).toHaveCount(0)
  await expect(page.getByText('Tarea del sabatino')).toBeVisible()
  await expect(page.getByText('Tarea para todos')).toBeVisible()
  await expect(page.getByText('Tarea de 101A')).toHaveCount(0)
  await expect.poll(() => historial.at(-1)).toBe('2')

  await page.getByRole('button', { name: '101A' }).click()
  await expect(page).toHaveURL(/grupo=1$/)
  await expect(page.getByText('Ana del Grupo A')).toBeVisible()
  await expect(page.getByText('Beto del Sabatino')).toHaveCount(0)
  await expect.poll(() => historial.at(-1)).toBe('1')

  await page.getByRole('button', { name: 'Todos los grupos' }).click()
  await expect(page.getByRole('heading', { name: 'Matemáticas', exact: true })).toBeVisible()
  await expect(page.getByText('Ana del Grupo A')).toBeVisible()
  await expect(page.getByText('Beto del Sabatino')).toBeVisible()
})
