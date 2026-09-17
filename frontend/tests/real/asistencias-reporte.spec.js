import { test, expect } from '@playwright/test'
import { USERS, login, materiaE2E } from './helpers.js'

// El colega es quien tiene horario en la materia E2E; el historial de
// asistencias sólo ofrece materias con horario o sesiones del docente.
test('el docente descarga el acumulado de la materia sin aplicar filtros', async ({ page }) => {
  await login(page, USERS.colega)
  const materia = await materiaE2E(page)
  const grupo = materia.grupos[0]

  await page.goto('/asistencias')
  const card = page.getByRole('region', { name: 'Reporte acumulado hasta hoy' })
  await card.scrollIntoViewIfNeeded()

  // Materia y grupo quedan preseleccionados: el reporte sale con un clic.
  await expect(card.getByLabel('Materia')).toHaveValue(String(materia.id))
  await expect(card.getByLabel('Grupo (opcional)')).toHaveValue(String(grupo.id))
  await expect(card).toContainText(`${materia.nombre} · ${grupo.nombre} · todas las unidades · acumulado al`)
  await page.screenshot({ path: test.info().outputPath('reporte-acumulado.png') })

  const [download, request] = await Promise.all([
    page.waitForEvent('download'),
    page.waitForRequest((req) => req.url().includes(`/asistencias/exportar/${materia.id}`)),
    card.getByRole('button', { name: 'Exportar Excel' }).click(),
  ])

  expect(download.suggestedFilename()).toBe(`asistencias-${materia.id}.xlsx`)
  const params = new URL(request.url()).searchParams
  expect(params.get('formato')).toBe('excel')
  expect(params.get('grupoId')).toBe(String(grupo.id))
  for (const filtro of ['unidadId', 'fecha', 'semana', 'mes', 'sesionId']) {
    expect(params.has(filtro), `no debe mandar ${filtro}`).toBe(false)
  }
  const response = await request.response()
  expect(response.ok()).toBeTruthy()
  expect(response.headers()['content-type']).toContain('spreadsheet')
})
