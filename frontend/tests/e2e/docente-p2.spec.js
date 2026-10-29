import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi, materia } from './fixtures'

const grupoA = { id: 1, nombre: '101A' }
const grupoB = { id: 2, nombre: '101-SA' }

async function materiaConGrupos(page) {
  await page.route('**/api/materias/1', (route) => route.fulfill({ json: {
    ...materia, grupos: [grupoA, grupoB], docente: { id: 2, nombre: 'Docente' }, unidades: [{ id: 1, nombre: 'Unidad 1', orden: 1, status: 'ACTIVA' }],
    inscripciones: [{ id: 1, alumnoId: 10, grupoId: 1, estado: 'ACEPTADA', alumno: { id: 10, nombre: 'Ana López', numeroControl: '22500' } }],
  } }))
  await page.route('**/api/tareas/materia/1', (route) => route.fulfill({ json: [{ id: 5, titulo: 'Práctica 1', grupoId: 1, tieneFechaLimite: false }] }))
  await page.route('**/api/avisos**', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/asistencias/historial**', (route) => route.fulfill({ json: {
    items: [{ id: 33, fecha: '2026-10-06T15:00:00.000Z', grupo: grupoA, unidad: { nombre: 'Unidad 1' }, resumen: { asistencias: 20, retardos: 1, faltas: 2 } }],
    estadisticas: { asistencias: 20, retardos: 1, faltas: 2, justificados: 0, porcentaje: 87 },
  } }))
}

const azules = (page) => page.locator('main').locator('a.bg-primary:visible, button.bg-primary:visible').count()

test('la materia lleva su contexto a las otras pantallas y no usa tarjetas de métricas', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await materiaConGrupos(page)
  await page.goto('/materias/1?grupo=1')

  await expect(page.getByRole('heading', { level: 1, name: 'Matemáticas · 101A' })).toBeVisible()
  await expect(page.getByText('1 alumno · 1 unidad · 1 clase registrada · 87 % de asistencia')).toBeVisible()
  await expect(page.getByText('Tareas creadas')).toHaveCount(0)
  const nav = page.getByRole('navigation', { name: 'Ir con esta materia' })
  await expect(nav.getByRole('link', { name: 'Asistencias' })).toHaveAttribute('href', '/asistencias?materia=1&grupo=1')
  await expect(nav.getByRole('link', { name: 'Tareas' })).toHaveAttribute('href', '/tareas?materia=1&grupo=1')
  await expect(nav.getByRole('link', { name: 'Calificaciones' })).toHaveAttribute('href', '/calificaciones?materia=1&grupo=1')
  await expect(page.getByRole('link', { name: 'Editar lista' })).toHaveAttribute('href', '/docente/pasar-lista/33')
  await expect(page.getByRole('link', { name: 'Nueva tarea' })).toHaveAttribute('href', '/docente/tareas/crear?materiaId=1&grupoId=1')
  expect(await azules(page)).toBeLessThanOrEqual(1)
})

test('Asistencias abre el historial filtrado cuando llega desde una materia', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  const pedidos = []
  await page.route('**/api/asistencias/historial**', (route) => {
    pedidos.push(Object.fromEntries(new URL(route.request().url()).searchParams))
    return route.fulfill({ json: { items: [], estadisticas: null } })
  })
  await page.goto('/asistencias?materia=1&grupo=1')
  await expect.poll(() => pedidos[0]).toEqual({ materiaId: '1', grupoId: '1' })
  await expect(page.getByRole('combobox', { name: 'Materia', exact: true }).last()).toHaveValue('1')
})

test('el menú dice "Docente", no el valor interno del rol', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.goto('/docente/horario')
  await expect(page.getByRole('heading', { level: 1, name: 'Mi horario' })).toBeVisible()
  await expect(page.locator('.user__role')).toHaveText('Docente')
})

for (const ruta of ['/asistencias', '/docente/grupos', '/docente/riesgo', '/docente/solicitudes', '/docente/horario']) {
  test(`una sola acción azul y sin errores de axe en ${ruta}`, async ({ page }) => {
    await mockApi(page, 'DOCENTE')
    await page.route('**/api/grupos/mis-grupos', (route) => route.fulfill({ json: [1, 2, 3].map((id) => ({
      id, nombre: `${id}A`, carrera: { nombre: 'Sistemas' }, semestre: id, periodo: '2026-B', _count: { alumnos: 20 }, agregado: id === 3, materias: [{ id: 1, nombre: 'Matemáticas' }],
    })) }))
    await page.route('**/api/dashboard/docente/riesgo**', (route) => route.fulfill({ json: {
      criterio: { porcentaje: 20, minRegistros: 4 },
      alumnos: [0, 1].map((i) => ({ alumno: { id: 20 + i, nombre: `Alumno ${i}`, numeroControl: `2260${i}` }, materia: { id: 1, nombre: 'Matemáticas' }, grupo: grupoA, porcentajeAusencias: 30, faltas: 4, retardos: 1, registros: 12, tendencia: ['FALTA', 'ASISTENCIA', 'FALTA'], tareasVencidas: 2, tareasSinEntregar: 1, ultimoAviso: null })),
    } }))
    await page.route('**/api/inscripciones/pendientes', (route) => route.fulfill({ json: [
      { id: 1, alumno: { nombre: 'Rebeca Paredes', numeroControl: '22999' }, materia: { nombre: 'Matemáticas' }, periodo: '2026-B', createdAt: '2026-10-05T10:00:00Z' },
      { id: 2, alumno: { nombre: 'Saúl Cortés' }, materia: { nombre: 'Matemáticas' }, periodo: '2026-B', createdAt: '2026-10-06T10:00:00Z' },
    ] }))
    await page.goto(ruta)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForTimeout(400)
    expect(await azules(page)).toBeLessThanOrEqual(1)
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([])
  })
}
