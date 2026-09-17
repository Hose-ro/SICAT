import { test, expect } from '@playwright/test'
import { USERS, api, login } from './helpers.js'

async function elegirMateriaE2E(page) {
  const value = await page.getByLabel('Materia').locator('option', { hasText: 'E2E Materia' }).getAttribute('value')
  await page.getByLabel('Materia').selectOption(value)
}

test('la ponderación se guarda en la materia y la ve el alumno', async ({ page, browser }) => {
  await login(page, USERS.docente)
  await page.goto('/calificaciones')
  await elegirMateriaE2E(page)
  await expect(page.getByLabel('Tareas %')).toHaveValue('80')
  await page.getByLabel('Tareas %').fill('70')
  await page.getByLabel('Asistencia %').fill('30')
  await page.getByRole('button', { name: 'Guardar ponderación' }).click()
  await expect(page.getByRole('status')).toContainText('Ponderación guardada')

  await page.reload()
  await elegirMateriaE2E(page)
  await expect(page.getByLabel('Tareas %')).toHaveValue('70')
  await expect(page.getByLabel('Asistencia %')).toHaveValue('30')

  const alumno = await browser.newPage()
  await login(alumno, USERS.alumno)
  const res = await api(alumno).get('/calificaciones/alumno')
  expect(res.ok()).toBeTruthy()
  const reporte = (await res.json()).reportes.find((r) => r.materia?.clave === 'E2E-1')
  expect(reporte?.ponderacion).toEqual({ tareas: 70, asistencia: 30 })
  await alumno.close()
})
