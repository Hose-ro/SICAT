import { test, expect } from '@playwright/test'
import { USERS, api, login, materiaE2E } from './helpers.js'

// El horario del colega es los lunes: se usa el lunes anterior a hoy para que
// la clase ya haya ocurrido y se pueda registrar como atrasada.
function lunesAnterior() {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - (((fecha.getDay() + 6) % 7) || 7))
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

test('el ranking de faltas se muestra plegado y se despliega al pulsarlo', async ({ page }) => {
  await login(page, USERS.colega)
  const materia = await materiaE2E(page)
  const { horarios } = await (await api(page).get('/horarios/mis-horarios')).json()
  const horario = horarios.find((h) => h.materiaId === materia.id)
  expect(horario, 'el colega debe tener horario en la materia E2E').toBeTruthy()

  // Sin una unidad iniciada no se puede capturar asistencia.
  const unidad = await api(page).patch(`/unidades/${materia.unidades[0].id}/iniciar`)
  expect(unidad.ok(), await unidad.text()).toBeTruthy()
  const sesionRes = await api(page).post('/clases/atrasada', { data: { horarioId: horario.id, fecha: lunesAnterior() } })
  expect(sesionRes.ok(), await sesionRes.text()).toBeTruthy()
  const sesion = await sesionRes.json()
  const detalle = await (await api(page).get(`/materias/${materia.id}`)).json()
  const alumno = detalle.inscripciones.find((i) => i.alumno.numeroControl === USERS.alumno).alumno
  const lista = await api(page).post('/asistencias/pasar-lista', {
    data: { claseSesionId: sesion.id, registros: [{ alumnoId: alumno.id, estado: 'FALTA' }] },
  })
  expect(lista.ok(), await lista.text()).toBeTruthy()

  await page.goto('/asistencias')
  const toggle = page.getByRole('button', { name: /Ranking de alumnos con más faltas/ })
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toContainText('1 alumno · hasta 1 falta')
  const panel = page.locator(`[id="${await toggle.getAttribute('aria-controls')}"]`)
  await expect(panel).toHaveCount(0)
  await toggle.scrollIntoViewIfNeeded()
  await page.screenshot({ path: test.info().outputPath('ranking-plegado.png') })

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(panel.getByRole('listitem')).toHaveCount(1)
  await expect(panel).toContainText('E2E Alumno')
  await expect(panel).toContainText(USERS.alumno)
  await expect(panel).toContainText('1 falta')
  await page.screenshot({ path: test.info().outputPath('ranking-abierto.png') })

  await toggle.click()
  await expect(panel).toHaveCount(0)
})
