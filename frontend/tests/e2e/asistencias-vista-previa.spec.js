import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi, materia, grupo } from './fixtures'

// Dos sesiones registradas; la vista previa de una sola sesión debe mostrar
// únicamente su columna y la del acumulado ambas.
const sesiones = [
  { id: 10, fecha: '2026-09-10T08:00:00', semanaClave: '2026-09-07', grupoId: 1, unidadId: 1 },
  { id: 11, fecha: '2026-09-14T08:00:00', semanaClave: '2026-09-14', grupoId: 1, unidadId: 1 },
]
const alumnos = [
  { id: 1, nombre: 'Ana Prueba', numeroControl: '225Q0103' },
  { id: 3, nombre: 'Luis Prueba', numeroControl: '225Q0104' },
]
const asistencias = [
  { alumnoId: 1, claseSesionId: 10, estado: 'ASISTENCIA' },
  { alumnoId: 1, claseSesionId: 11, estado: 'RETARDO' },
  { alumnoId: 3, claseSesionId: 10, estado: 'FALTA' },
]
const sesionHistorial = {
  id: 10, fecha: '2026-09-10T08:00:00', semanaClave: '2026-09-07', materia, grupo,
  aula: { id: 1, nombre: 'Aula 1' }, unidad: { id: 1, nombre: 'Unidad 1' },
  resumen: { asistencias: 1, faltas: 1, retardos: 0, justificados: 0 },
}

async function mockReporte(page) {
  await mockApi(page, 'DOCENTE')
  // Rutas registradas después tienen prioridad sobre el comodín de mockApi.
  await page.route('**/api/asistencias/historial**', (route) => route.fulfill({ json: { items: [sesionHistorial], estadisticas: null } }))
  await page.route('**/api/asistencias/reporte/1**', (route) => {
    const sesionId = new URL(route.request().url()).searchParams.get('sesionId')
    const incluidas = sesionId ? sesiones.filter((s) => String(s.id) === sesionId) : sesiones
    return route.fulfill({ json: {
      materia: { ...materia, docente: { id: 2, nombre: 'Docente de prueba' } },
      filtros: {},
      sesiones: incluidas,
      alumnos,
      asistencias: asistencias.filter((a) => incluidas.some((s) => s.id === a.claseSesionId)),
    } })
  })
}

const fila = (dialog, nombre) => dialog.getByRole('row', { name: new RegExp(nombre) })

test('acumulado: "Ver" abre la vista previa con todas las sesiones y descarga desde ahí', async ({ page }) => {
  await mockReporte(page)
  await page.goto('/asistencias')
  const card = page.getByRole('region', { name: 'Reporte acumulado hasta hoy' })
  await expect(card.getByLabel('Materia')).toHaveValue('1')
  await expect(card.getByLabel('Grupo (opcional)')).toHaveValue('1')

  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().includes('/asistencias/reporte/1')),
    card.getByRole('button', { name: 'Ver', exact: true }).click(),
  ])
  const params = new URL(request.url()).searchParams
  expect(params.get('grupoId')).toBe('1')
  expect(params.has('sesionId')).toBe(false)

  const dialog = page.getByRole('dialog', { name: 'Vista previa del reporte' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Matemáticas · 101A · todas las unidades · acumulado al')
  await expect(dialog).toContainText(/2 sesiones · (?:\d+ días sin clases · )?2 alumnos/)
  await expect(dialog.getByRole('columnheader', { name: '10/09' })).toBeVisible()
  await expect(dialog.getByRole('columnheader', { name: '14/09' })).toBeVisible()
  // Ana: A en la 1ª, R en la 2ª → 1 A, 1 R, 50 %. Luis: F en la 1ª, sin registro en la 2ª → 0 %.
  await expect(fila(dialog, 'Ana Prueba')).toContainText(/A\s*R\s*1\s*0\s*1\s*0\s*50%/)
  await expect(fila(dialog, 'Luis Prueba')).toContainText(/F\s*-\s*0\s*1\s*0\s*0\s*0%/)

  const violations = (await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations
  expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html) }))).toEqual([])
  await page.screenshot({ path: 'audit/asistencias-vista-previa-acumulado.png' })

  const [download, exportRequest] = await Promise.all([
    page.waitForEvent('download'),
    page.waitForRequest((req) => req.url().includes('/asistencias/exportar/1')),
    dialog.getByRole('button', { name: 'Descargar Excel' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('asistencias-1.xlsx')
  const exportParams = new URL(exportRequest.url()).searchParams
  expect(exportParams.get('formato')).toBe('excel')
  expect(exportParams.get('grupoId')).toBe('1')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('sesiones registradas: "Ver" muestra sólo esa sesión y descarga el PDF', async ({ page }) => {
  await mockReporte(page)
  await page.goto('/asistencias')
  await page.getByRole('button', { name: /Historial de clases/ }).click()

  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().includes('/asistencias/reporte/1')),
    page.getByRole('button', { name: 'Ver', exact: true }).last().click(),
  ])
  expect(new URL(request.url()).searchParams.get('sesionId')).toBe('10')

  const dialog = page.getByRole('dialog', { name: 'Vista previa del reporte' })
  await expect(dialog).toContainText('Matemáticas · 101A · Unidad 1 · 10 sep 2026')
  await expect(dialog).toContainText(/1 sesión · (?:\d+ días sin clases · )?2 alumnos/)
  await expect(dialog.getByRole('columnheader', { name: '10/09' })).toBeVisible()
  await expect(dialog.getByRole('columnheader', { name: '14/09' })).toHaveCount(0)
  await expect(fila(dialog, 'Ana Prueba')).toContainText(/A\s*1\s*0\s*0\s*0\s*100%/)
  await expect(fila(dialog, 'Luis Prueba')).toContainText(/F\s*0\s*1\s*0\s*0\s*0%/)
  await page.screenshot({ path: 'audit/asistencias-vista-previa-sesion.png' })

  const [download, exportRequest] = await Promise.all([
    page.waitForEvent('download'),
    page.waitForRequest((req) => req.url().includes('/asistencias/exportar/1')),
    dialog.getByRole('button', { name: 'Descargar PDF' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('asistencias-1.pdf')
  const exportParams = new URL(exportRequest.url()).searchParams
  expect(exportParams.get('formato')).toBe('pdf')
  expect(exportParams.get('sesionId')).toBe('10')
})
