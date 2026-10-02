import { test, expect } from '@playwright/test'
import { mockApi, materia, grupo } from './fixtures'

// Un grupo nuevo sin tareas trae las del mismo curso en el periodo pasado.
const grupoNuevo = { ...grupo, id: 2, nombre: '101B', periodo: '2026-B' }
const materiaConGrupo = { ...materia, grupos: [grupoNuevo], unidades: [{ id: 1, nombre: 'Unidad 1', orden: 1, status: 'ACTIVA' }] }
const importables = [{
  grupo: { id: 1, nombre: '101A', periodo: '2026-A', modalidad: 'ESCOLARIZADO' }, desplazamientoDias: 182,
  tareas: [
    { id: 10, titulo: 'Práctica 1: derivadas', tieneFechaLimite: true, fechaLimite: '2026-02-11T05:59:00Z', fechaSugerida: '2026-08-12T05:59:00Z', unidadRef: { id: 1, nombre: 'Unidad 1' }, categoria: { id: 1, nombre: 'Prácticas' } },
    { id: 11, titulo: 'Examen parcial 1', tieneFechaLimite: true, fechaLimite: '2026-03-04T05:59:00Z', fechaSugerida: '2026-09-02T05:59:00Z', unidadRef: { id: 1, nombre: 'Unidad 1' }, categoria: { id: 2, nombre: 'Examen' } },
    { id: 12, titulo: 'Proyecto final', tieneFechaLimite: false, fechaLimite: null, fechaSugerida: null, unidadRef: null, categoria: null },
  ],
}]

test('importa las tareas elegidas de otro grupo con las fechas movidas', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/materias/mis-materias**', (route) => route.fulfill({ json: [materiaConGrupo] }))
  await page.route('**/api/tareas/docente**', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/tareas/importables**', (route) => route.fulfill({ json: importables }))
  let enviado
  await page.route('**/api/tareas/importar', (route) => {
    enviado = route.request().postDataJSON()
    return route.fulfill({ json: { creadas: [{ id: 50, titulo: 'a' }, { id: 51, titulo: 'b' }], adjuntosOmitidos: 0 } })
  })

  await page.goto('/tareas')
  await expect(page.getByText('101B todavía no tiene tareas.')).toBeVisible()
  await page.getByRole('button', { name: 'Importar tareas' }).click()
  await expect(page.getByText('Cada fecha se recorre 26 semanas')).toBeVisible()
  await page.getByLabel(/Proyecto final/).uncheck()
  await page.getByRole('button', { name: 'Importar 2 tareas' }).click()

  await expect(page.getByText(/Importaste 2 tareas en borrador a 101B/)).toBeVisible()
  expect(enviado).toEqual({ materiaId: 1, grupoDestinoId: 2, tareaIds: [10, 11], ajustarFechas: true })
})
