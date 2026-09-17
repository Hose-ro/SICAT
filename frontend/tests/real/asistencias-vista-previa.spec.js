import { test, expect } from '@playwright/test'
import { USERS, login, materiaE2E } from './helpers.js'

// El fixture no registra sesiones: la vista previa debe salir vacía de
// columnas pero con el alumno inscrito y aceptado en el grupo.
test('el docente ve el acumulado en pantalla antes de descargarlo', async ({ page }) => {
  await login(page, USERS.colega)
  const materia = await materiaE2E(page)
  const grupo = materia.grupos[0]

  await page.goto('/asistencias')
  const card = page.getByRole('region', { name: 'Reporte acumulado hasta hoy' })
  await expect(card.getByLabel('Grupo (opcional)')).toHaveValue(String(grupo.id))

  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().includes(`/asistencias/reporte/${materia.id}`)),
    card.getByRole('button', { name: 'Ver', exact: true }).click(),
  ])
  expect(new URL(request.url()).searchParams.get('grupoId')).toBe(String(grupo.id))
  expect((await request.response()).ok()).toBeTruthy()

  const dialog = page.getByRole('dialog', { name: 'Vista previa del reporte' })
  await expect(dialog).toContainText(`${materia.nombre} · ${grupo.nombre} · todas las unidades · acumulado al`)
  await expect(dialog).toContainText('0 sesiones · 1 alumno')
  await expect(dialog.getByRole('row', { name: /E2E Alumno/ })).toContainText(/E2E00001\s*0\s*0\s*0\s*0\s*0%/)
  await expect(dialog.getByRole('row', { name: /Pendiente/ })).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('vista-previa-acumulado.png') })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Descargar Excel' }).click(),
  ])
  expect(download.suggestedFilename()).toBe(`asistencias-${materia.id}.xlsx`)
})
