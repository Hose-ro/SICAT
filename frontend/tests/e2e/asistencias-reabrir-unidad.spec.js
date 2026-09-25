import { test, expect } from '@playwright/test'
import { mockApi, horario, materia } from './fixtures'

// La Unidad 2 se finalizó por error: sin unidad activa, la tarjeta de la clase
// debe ofrecer regresar a ella y, al confirmar, dejarla activa otra vez.
test('clase sin unidad activa: "Regresar a Unidad 2" la reabre', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  let reabierta = false

  await page.route('**/api/clases/docente/panel', (route) => {
    const unidades = [
      { id: 1, nombre: 'Unidad 1', orden: 1, status: 'FINALIZADA' },
      { id: 2, nombre: 'Unidad 2', orden: 2, status: reabierta ? 'ACTIVA' : 'FINALIZADA' },
      { id: 3, nombre: 'Unidad 3', orden: 3, status: 'PENDIENTE' },
    ]
    const clase = {
      ...horario,
      horarioId: 1,
      estado: 'PROXIMA',
      sesion: null,
      materia: { ...materia, unidades },
      unidadActiva: reabierta ? unidades[1] : null,
    }
    return route.fulfill({ json: { clasesHoy: [clase], claseActual: clase } })
  })
  await page.route('**/api/unidades/2/reabrir', (route) => {
    reabierta = route.request().method() === 'PATCH'
    return route.fulfill({ json: { id: 2, status: 'ACTIVA' } })
  })

  await page.goto('/asistencias')
  // La clase aparece como principal y en la lista del día; basta la primera.
  const card = page.getByRole('article').first()
  await expect(card.getByRole('button', { name: 'Inicia Unidad 3 primero' })).toBeDisabled()

  await card.getByRole('button', { name: 'Regresar a Unidad 2' }).click()
  const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'))
  await expect(dialog).toContainText('Unidad 2 volverá a estar activa')
  await dialog.getByRole('button', { name: 'Reabrir Unidad 2' }).click()

  await expect(card.getByRole('button', { name: 'Finalizar Unidad 2' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Regresar a/ })).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Iniciar clase' })).toBeEnabled()
})
