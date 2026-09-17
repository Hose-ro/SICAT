import { expect } from '@playwright/test'
import { API } from '../../playwright.real.config.js'

export const PASSWORD = process.env.E2E_PASSWORD || 'Sicat-e2e-2026!'
export const USERS = { docente: 'e2e.docente', colega: 'e2e.colega', ajeno: 'e2e.ajeno', alumno: 'E2E00001' }

/** Login real por la interfaz; la cookie httpOnly queda en el contexto. */
export async function login(page, identifier, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel(/usuario|número de control/i).first().fill(identifier)
  await page.getByLabel(/contraseña/i).first().fill(password)
  await page.getByRole('button', { name: /iniciar sesión|entrar/i }).click()
  // Cada rol aterriza en una ruta distinta (ALUMNO va a /materias); basta con salir de /login.
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('complementary', { name: 'Menú principal' })).toBeVisible()
}

/** Llamada a la API con las cookies del contexto de la página. */
export function api(page) {
  const base = `${API}/api`
  return {
    get: (path, options) => page.request.get(base + path, options),
    post: (path, options) => page.request.post(base + path, options),
    patch: (path, options) => page.request.patch(base + path, options),
  }
}

export async function materiaE2E(page) {
  const res = await api(page).get('/materias/mis-materias')
  expect(res.ok()).toBeTruthy()
  const materia = (await res.json()).find((m) => m.clave === 'E2E-1')
  expect(materia, 'la materia E2E debe existir para el usuario').toBeTruthy()
  return materia
}
