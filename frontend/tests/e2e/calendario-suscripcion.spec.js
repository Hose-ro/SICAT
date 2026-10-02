import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures'

test('el docente crea el enlace de su calendario y lo puede desactivar', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  let activo = false
  await page.route('**/api/calendario/suscripcion', (route) => {
    const metodo = route.request().method()
    if (metodo === 'POST') { activo = true; return route.fulfill({ json: { token: 'tok_abcdefghijklmnopqrstuvwx' } }) }
    if (metodo === 'DELETE') { activo = false; return route.fulfill({ json: { activo: false } }) }
    return route.fulfill({ json: { activo } })
  })

  await page.goto('/docente/horario')
  await page.getByRole('button', { name: 'Agregar a mi calendario' }).click()
  await page.getByRole('button', { name: 'Crear enlace' }).click()

  const enlace = page.getByLabel('Tu enlace')
  await expect(enlace).toHaveValue(/\/api\/calendario\/tok_abcdefghijklmnopqrstuvwx\.ics$/)
  // El servidor de pruebas es http: Calendario de Apple sólo se suscribe por HTTPS.
  await expect(page.getByText('Este servidor no usa HTTPS')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Descargar el archivo .ics' }))
    .toHaveAttribute('href', /\/api\/calendario\/tok_abcdefghijklmnopqrstuvwx\.ics$/)

  await page.getByRole('button', { name: 'Desactivar el enlace' }).click()
  await expect(page.getByText('El enlace dejó de funcionar.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear enlace' })).toBeVisible()
})
