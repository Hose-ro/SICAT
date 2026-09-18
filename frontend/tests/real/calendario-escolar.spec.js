import { test, expect } from '@playwright/test'
import { USERS, api, login } from './helpers.js'

// Mañana siempre está libre de listas capturadas, así que el festivo nunca choca
// con sesiones reales de la BD de desarrollo.
const manana = new Date()
manana.setDate(manana.getDate() + 1)
const FECHA = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, '0')}-${String(manana.getDate()).padStart(2, '0')}`
const DIA_LARGO = new RegExp(`${manana.getDate()} de ${manana.toLocaleDateString('es-MX', { month: 'long' })} de ${manana.getFullYear()}`)
const MOTIVO = 'E2E festivo institucional'

/** Abre el acordeón del calendario y deja a la vista el mes de mañana. */
async function abrirCalendario(page, titulo) {
  await page.getByRole('button', { name: titulo }).click()
  // El mes tarda en pintarse mientras llega el periodo; sin esperar, la celda
  // "no existe" y se avanzaría de mes por error.
  await expect(page.getByRole('button', { name: 'Mes siguiente' })).toBeVisible()
  const celda = page.getByRole('button', { name: DIA_LARGO })
  if (!(await celda.count())) await page.getByRole('button', { name: 'Mes siguiente' }).click()
  await expect(celda).toBeVisible()
  return celda
}

test.describe.serial('festivo institucional', () => {
  test('el admin marca un festivo para toda la institución', async ({ page }) => {
    await login(page, USERS.admin)
    await page.goto('/admin/calendario')
    const celda = await abrirCalendario(page, /Calendario escolar/)
    await expect(celda).toHaveAccessibleName(/día del periodo/)
    await celda.click()
    await page.getByLabel('Motivo por el que no habrá clases').fill(MOTIVO)
    await page.getByRole('button', { name: 'Marcar festivo para todos' }).click()

    await expect(page.getByRole('status')).toContainText('para toda la institución')
    await expect(celda).toHaveAccessibleName(new RegExp(`sin clases, ${MOTIVO}`))
    const res = await api(page).get('/periodos/actual/suspensiones-institucionales')
    expect(await res.json()).toEqual(expect.arrayContaining([expect.objectContaining({ fecha: FECHA, motivo: MOTIVO })]))
  })

  test('el docente lo ve en su panel y no puede tocarlo en su calendario', async ({ page }) => {
    await login(page, USERS.colega)
    await expect(page.getByText('Próximos días sin clases')).toBeVisible()
    await expect(page.getByText(MOTIVO)).toContainText('institución')

    await page.goto('/docente/horario')
    const celda = await abrirCalendario(page, /Calendario de clases/)
    await expect(celda).toHaveAccessibleName(new RegExp(`sin clases \\(institucional\\), ${MOTIVO}`))
    await expect(celda).toBeDisabled()
    await expect(celda).toContainText('Festivo')
    await expect(page.getByText(`festivo institucional: ${MOTIVO}`)).toBeVisible()

    // Por la API tampoco: el docente no puede pisar ni levantar el festivo.
    const propio = await api(page).post('/periodos/actual/suspensiones', { data: { fechas: [FECHA], motivo: 'Mío' } })
    expect(propio.status()).toBe(400)
    const borrar = await api(page).delete(`/periodos/actual/suspensiones-institucionales/${FECHA}`)
    expect(borrar.status()).toBe(403)
  })

  test('el admin restablece las clases de ese día', async ({ page }) => {
    await login(page, USERS.admin)
    await page.goto('/admin/calendario')
    const celda = await abrirCalendario(page, /Calendario escolar/)
    await celda.click()
    await page.getByRole('button', { name: 'Restablecer clases de este día' }).click()
    await expect(celda).toHaveAccessibleName(/día del periodo/)
    const res = await api(page).get('/periodos/actual/suspensiones-institucionales')
    expect((await res.json()).some((item) => item.fecha === FECHA)).toBe(false)
  })
})
