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
  await expect(page.getByRole('link', { name: 'Abrir en Calendario (iPhone, Mac)' }))
    .toHaveAttribute('href', /^webcal:\/\/.*\/api\/calendario\/tok_abcdefghijklmnopqrstuvwx\.ics$/)
  await expect(page.getByRole('link', { name: 'Agregar a Google Calendar' }))
    .toHaveAttribute('href', /calendar\.google\.com\/calendar\/render\?cid=webcal%3A%2F%2F/)

  await page.getByRole('button', { name: 'Desactivar el enlace' }).click()
  await expect(page.getByText('El enlace dejó de funcionar.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear enlace' })).toBeVisible()
})
