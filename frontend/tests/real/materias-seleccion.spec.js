import { test, expect } from '@playwright/test'
import { USERS, api, login } from './helpers.js'

// Con E2E_SHOTS=/ruta se guardan capturas de los pasos clave.
const shot = (page, name) => (
  process.env.E2E_SHOTS
    ? page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png`, fullPage: true })
    : Promise.resolve()
)

async function crearMateria(page, clave, nombre) {
  const res = await api(page).post('/materias', { data: { nombre, clave, numUnidades: 1 } })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

test('el docente edita y elimina sus materias, una por una o en lote', async ({ page }) => {
  await login(page, USERS.docente)
  const dos = await crearMateria(page, 'E2E-2', 'E2E Materia Dos')
  const tres = await crearMateria(page, 'E2E-3', 'E2E Materia Tres')

  await page.goto('/materias')
  await expect(page.getByRole('button', { name: 'Editar E2E Materia', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Eliminar E2E Materia', exact: true })).toBeVisible()
  await shot(page, '1-tarjetas-docente')

  // Varias seleccionadas: sólo se cambia lo que comparten (carrera/semestre).
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  await page.getByLabel('Seleccionar E2E Materia Dos').check()
  await page.getByLabel('Seleccionar E2E Materia Tres').check()
  await expect(page.getByText('2 de 3 seleccionadas')).toBeVisible()
  await shot(page, '2-seleccion')
  await page.getByRole('button', { name: 'Editar (2)' }).click()
  await shot(page, '3-editar-lote')
  await page.getByRole('dialog').getByLabel('Semestre').selectOption('5')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Se editaron 2 de 2 materia(s).' })).toBeVisible()
  await shot(page, '4-aviso-editadas')
  for (const id of [dos.id, tres.id]) {
    const res = await api(page).get(`/materias/${id}`)
    expect((await res.json()).semestre).toBe(5)
  }

  // Una sola seleccionada: abre el formulario completo de edición.
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  await page.getByLabel('Seleccionar E2E Materia Dos').check()
  await page.getByRole('button', { name: 'Editar (1)' }).click()
  await expect(page.getByRole('dialog')).toContainText('Editar materia')
  await page.getByLabel('Nombre *').fill('E2E Materia Dos editada')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('link', { name: 'E2E Materia Dos editada' })).toBeVisible()

  // Eliminar en lote con confirmación.
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  await page.getByLabel('Seleccionar E2E Materia Dos editada').check()
  await page.getByLabel('Seleccionar E2E Materia Tres').check()
  await page.getByRole('button', { name: 'Eliminar (2)' }).click()
  await shot(page, '5-confirmar-eliminar-lote')
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar 2', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Se eliminaron 2 de 2 materia(s).' })).toBeVisible()
  await expect(page.getByText('E2E Materia Tres')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'E2E Materia', exact: true })).toBeVisible()
  await shot(page, '6-aviso-eliminadas')
})

test('un docente ajeno no puede editar ni eliminar la materia', async ({ page }) => {
  await login(page, USERS.ajeno)
  const res = await api(page).get('/materias')
  const materia = (await res.json()).find((m) => m.clave === 'E2E-1')
  expect(materia).toBeTruthy()

  expect((await api(page).patch(`/materias/${materia.id}`, { data: { semestre: 2 } })).status()).toBe(403)
  expect((await api(page).delete(`/materias/${materia.id}`)).status()).toBe(403)

  // En lote no se aborta: se reporta la materia ajena y sigue existiendo.
  const lote = await api(page).delete('/materias/lote', { data: { materiaIds: [materia.id] } })
  expect(lote.ok()).toBeTruthy()
  expect(await lote.json()).toEqual({
    eliminadas: 0,
    errores: [{ id: materia.id, motivo: 'No impartes esta materia' }],
  })
  expect((await api(page).get(`/materias/clave/E2E-1`)).ok()).toBeTruthy()
})
