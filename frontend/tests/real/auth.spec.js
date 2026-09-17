import { test, expect } from '@playwright/test'
import { API } from '../../playwright.real.config.js'
import { USERS, PASSWORD, login } from './helpers.js'

test('rechaza credenciales incorrectas con el mensaje del servidor', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(USERS.docente)
  await page.getByLabel(/contraseña/i).first().fill('incorrecta-123')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('inicia sesión con cookie httpOnly y la sesión sobrevive a una recarga', async ({ page }) => {
  await login(page, USERS.docente)
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText('E2E Docente')).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/dashboard/)
  const me = await page.request.get(`${API}/api/auth/me`)
  expect(me.ok()).toBeTruthy()
  expect((await me.json()).rol).toBe('DOCENTE')
})

test('las rutas de otro rol no son accesibles', async ({ page }) => {
  await login(page, USERS.alumno, PASSWORD)
  await page.goto('/docente/solicitudes')
  await expect(page).not.toHaveURL(/\/docente\/solicitudes/)
  const res = await page.request.get(`${API}/api/inscripciones/pendientes`)
  expect(res.status()).toBe(403)
})
