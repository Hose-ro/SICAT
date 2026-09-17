import { test, expect } from '@playwright/test'
import { USERS, api, login } from './helpers.js'

test('el docente ve la solicitud pendiente real y la acepta', async ({ page }) => {
  await login(page, USERS.docente)
  await page.goto('/docente/solicitudes')
  await expect(page.getByText('E2E Alumno Pendiente')).toBeVisible()
  await page.getByRole('button', { name: 'Aceptar' }).first().click()
  await expect(page.getByText('E2E Alumno Pendiente')).toHaveCount(0)
  await expect(page.getByText('No hay solicitudes pendientes')).toBeVisible()
  const res = await api(page).get('/inscripciones/pendientes')
  expect(await res.json()).toEqual([])
})
