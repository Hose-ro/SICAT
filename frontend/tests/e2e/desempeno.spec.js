import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'

const panel = {
  claseActual: null, proximaClase: null, clasesHoy: [], proximasSuspensiones: [],
  resumen: { materias: 1, clasesHoy: 0, listasPendientes: 0 },
  pendientes: { alumnosEnRiesgo: 0, entregasSinCalificar: 0, solicitudes: 0 },
  materias: [
    { id: 1, nombre: 'Matemáticas', clave: 'MAT-1', grupo: { id: 1, nombre: '101A' }, alumnos: 3, unidadActiva: { id: 2, nombre: 'Unidad 2', orden: 2 }, porcentajeAsistencia: 90, entregasSinCalificar: 0, alumnosEnRiesgo: 0 },
  ],
}
const alumno = (id, nombre, calificacion, desempeno, motivos = []) => ({
  alumno: { id, nombre, numeroControl: `22${id}` }, calificacion, calculada: calificacion, fuente: 'CALCULADA',
  asistencia: { porcentaje: 88, registradas: 8, faltas: 1, retardos: 0 }, participacion: 2,
  criterios: [
    { clave: 'c1', valor: calificacion, calificadas: 1, total: 1 },
    { clave: 'c2', valor: 85, calificadas: 4, total: 5 },
    { clave: 'c3', valor: 40, calificadas: 6, total: 5, puntos: 2 },
    { clave: 'c4', valor: 88, calificadas: 8, total: 8 },
  ],
  desempeno, motivos,
})
const desempeno = {
  materia: { id: 1, nombre: 'Matemáticas' }, grupo: { id: 1, nombre: '101A' },
  unidad: { id: 2, nombre: 'Unidad 2', orden: 2, status: 'ACTIVA' },
  unidades: [{ id: 1, nombre: 'Unidad 1', orden: 1, status: 'FINALIZADA' }, { id: 2, nombre: 'Unidad 2', orden: 2, status: 'ACTIVA' }, { id: 3, nombre: 'Unidad 3', orden: 3, status: 'PENDIENTE' }],
  criterios: [
    { clave: 'c1', id: 1, nombre: 'Examen', tipo: 'EXAMEN', peso: 40, meta: null },
    { clave: 'c2', id: 2, nombre: 'Prácticas', tipo: 'PRACTICAS', peso: 30, meta: null },
    { clave: 'c3', id: 3, nombre: 'Participación', tipo: 'PARTICIPACION', peso: 10, meta: 5 },
    { clave: 'c4', id: 4, nombre: 'Asistencia', tipo: 'ASISTENCIA', peso: 20, meta: null },
  ],
  origenCriterios: 'GRUPO', umbrales: { aprobatoria: 70, sinRiesgo: 80 },
  resumen: { total: 3, aprobados: 1, enRiesgo: 1, reprobados: 1, sinCalificar: 0 }, actividadesSinCriterio: 0,
  alumnos: [
    alumno(1, 'Ana Prueba López', 92, 'APROBADO'),
    alumno(2, 'Carlos Prueba Ruiz', 76, 'EN_RIESGO', ['CALIFICACION_LIMITE']),
    alumno(3, 'Luis Prueba Pérez', 58, 'REPROBADO', ['CALIFICACION_BAJA']),
  ],
}
const criterios = {
  materiaId: 1, grupoId: 1,
  base: { origen: 'GRUPO', criterios: desempeno.criterios },
  unidades: desempeno.unidades.map((unidad) => ({ unidad, personalizada: false, criterios: null })),
  catalogo: [], gruposDelDocente: [],
}

async function preparar(page) {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/dashboard/docente', (route) => route.fulfill({ json: panel }))
  await page.route('**/api/calificaciones/desempeno**', (route) => route.fulfill({ json: desempeno }))
  await page.route('**/api/calificaciones/criterios**', (route) => route.fulfill({ json: criterios }))
}

for (const [theme, width] of [['light', 1280], ['dark', 390]]) {
  test(`inicio: desempeño por unidad ${theme}@${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: theme })
    await preparar(page)
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('/dashboard')

    const seccion = page.getByRole('region', { name: 'Desempeño por unidad' })
    await expect(seccion).toBeVisible()
    await expect(seccion.getByText('Luis Prueba Pérez')).toBeVisible()
    if (width >= 768) {
      await expect(seccion.getByRole('columnheader', { name: /Examen/ })).toContainText('40 %')
      await expect(seccion.getByRole('rowheader').first()).toContainText('Luis Prueba Pérez')
    }
    await seccion.getByRole('radio', { name: /En riesgo/ }).click()
    await expect(seccion.getByText('Carlos Prueba Ruiz')).toBeVisible()
    await expect(seccion.getByText('Ana Prueba López')).toHaveCount(0)

    const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html.slice(0, 120)) }))).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'sin scroll horizontal').toBe(false)
    expect(await page.locator('main h1').count()).toBe(1)
    expect(errors).toEqual([])
  })
}

test('inicio: editar criterios desde el panel abre el editor de la clase', async ({ page }) => {
  await preparar(page)
  await page.goto('/dashboard')
  const seccion = page.getByRole('region', { name: 'Desempeño por unidad' })
  await seccion.getByRole('button', { name: 'Editar criterios' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Criterios de evaluación' })
  await expect(dialogo).toBeVisible()
  await expect(dialogo.getByLabel('Porcentaje de Examen')).toHaveValue('40')
  await expect(dialogo.getByText('Suma 100 %')).toBeVisible()
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(axe.violations.map((v) => v.id)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dialogo).toHaveCount(0)
})
