import { test, expect } from '@playwright/test'
import { mockApi, horario, materia } from './fixtures'

const unidades = [{ id: 1, nombre: 'Unidad 1', orden: 1, status: 'ACTIVA' }]
const clase = (horarioId, hora, extra) => ({
  ...horario, horarioId, horaInicio: hora, horaFin: hora.replace(/^0(\d)/, (_, h) => `0${Number(h) + 1}`),
  materia: { ...materia, unidades }, unidadActiva: unidades[0], sesion: null, estado: 'PROXIMA', ...extra,
})

async function panel(page, clases, claseActual = clases[0]) {
  await page.route('**/api/clases/docente/panel', (route) => route.fulfill({ json: { clasesHoy: clases, claseActual } }))
}

test('la clase del día tiene una sola acción azul y "Iniciar y pasar lista" abre la lista', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await panel(page, [clase(1, '07:00'), clase(2, '09:00'), clase(3, '11:00')])
  const iniciadas = []
  await page.route('**/api/clases/iniciar', (route) => {
    iniciadas.push(route.request().postDataJSON())
    return route.fulfill({ json: { id: 10 } })
  })
  await page.goto('/asistencias')

  const hoy = page.getByRole('region', { name: 'Hoy', exact: true })
  await expect(hoy.getByRole('article')).toHaveCount(3)
  // Las tres ofrecen iniciar, pero sólo la principal va en azul.
  expect(await hoy.locator('button.bg-primary').count()).toBe(1)
  await expect(page.getByRole('heading', { name: 'Clase actual' })).toHaveCount(0)

  await hoy.getByRole('article').first().getByRole('button', { name: 'Iniciar y pasar lista' }).click()
  await expect(page).toHaveURL(/\/docente\/pasar-lista\/10$/)
  expect(iniciadas).toEqual([{ horarioId: 1 }])
})

test('finalizar una unidad pide confirmación', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await panel(page, [clase(1, '07:00')])
  let finalizadas = 0
  await page.route('**/api/unidades/1/finalizar', (route) => {
    finalizadas += 1
    return route.fulfill({ json: { id: 1, status: 'FINALIZADA' } })
  })
  await page.goto('/asistencias')

  await page.getByRole('button', { name: 'Finalizar Unidad 1' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Finalizar Unidad 1' })
  await expect(dialogo).toContainText('podrás regresar a ella')
  await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  expect(finalizadas).toBe(0)

  await page.getByRole('button', { name: 'Finalizar Unidad 1' }).click()
  await dialogo.getByRole('button', { name: 'Finalizar Unidad 1' }).click()
  await expect.poll(() => finalizadas).toBe(1)
})

test('con la lista guardada, Pasar lista ofrece finalizar la clase y regresa', async ({ page }) => {
  const requests = await mockApi(page, 'DOCENTE')
  await page.goto('/dashboard')
  await page.goto('/docente/pasar-lista/10')
  await page.getByRole('button', { name: 'Marcar todos presentes' }).click()
  await page.getByRole('button', { name: 'Guardar asistencia' }).click()
  await expect(page.getByRole('status').filter({ hasText: /^Lista guardada a las/ })).toBeVisible()

  await page.getByRole('button', { name: 'Finalizar clase' }).click()
  await page.getByRole('dialog', { name: 'Finalizar clase' }).getByRole('button', { name: 'Finalizar clase' }).click()
  await expect.poll(() => requests.filter((r) => r.path === '/clases/10/finalizar').length).toBe(1)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('Finalizaste Matemáticas.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Descargar reporte' })).toBeVisible()
})

test('quitar un grupo y rechazar una solicitud piden confirmación', async ({ page }) => {
  const requests = await mockApi(page, 'DOCENTE')
  await page.route('**/api/grupos/mis-grupos', (route) => route.fulfill({ json: [
    { id: 7, nombre: '7B', carrera: { nombre: 'Industrial' }, semestre: 7, periodo: '2026-B', _count: { alumnos: 3 }, agregado: true, materias: [] },
  ] }))
  let quitados = 0
  await page.route('**/api/grupos/mis-grupos/7', (route) => {
    quitados += 1
    return route.fulfill({ json: { ok: true } })
  })
  await page.goto('/docente/grupos')
  await page.getByRole('button', { name: 'Quitar' }).click()
  const quitar = page.getByRole('dialog', { name: 'Quitar 7B de tus grupos' })
  await expect(quitar).toContainText('no se borran')
  await quitar.getByRole('button', { name: 'Cancelar' }).click()
  expect(quitados).toBe(0)
  await expect(page.getByRole('heading', { name: '7B' })).toBeVisible()

  await page.route('**/api/inscripciones/pendientes', (route) => route.fulfill({ json: [
    { id: 1, alumno: { nombre: 'Rebeca Paredes' }, materia: { nombre: 'Matemáticas' }, periodo: '2026-B', createdAt: '2026-10-05T10:00:00Z' },
  ] }))
  await page.goto('/docente/solicitudes')
  await page.getByRole('button', { name: 'Rechazar' }).click()
  const rechazar = page.getByRole('dialog', { name: 'Rechazar solicitud' })
  await expect(rechazar).toContainText('Rebeca Paredes no quedará inscrito en Matemáticas')
  await rechazar.getByRole('button', { name: 'Cancelar' }).click()
  expect(requests.filter((r) => r.path.includes('/rechazar'))).toHaveLength(0)
})

for (const width of [390, 1440]) {
  test(`la lista de alumnos de la materia cabe y la baja va en el menú (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockApi(page, 'DOCENTE')
    const inscripciones = ['Ana López', 'María Fernanda Castillo Herrera', 'Luis Pérez'].map((nombre, i) => ({
      id: i + 1, alumnoId: 10 + i, grupoId: 1, estado: 'ACEPTADA',
      alumno: { id: 10 + i, nombre, numeroControl: i === 2 ? null : `2250${i}`, email: `alumno.con.un.correo.largo${i}@escuela.edu.mx`, telefono: i ? '6141234567' : null },
    }))
    await page.route('**/api/materias/1', (route) => route.fulfill({ json: { ...materia, grupos: [{ id: 1, nombre: '101A' }], docente: { id: 2, nombre: 'Docente' }, inscripciones } }))
    await page.route('**/api/tareas/materia/1', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/avisos**', (route) => route.fulfill({ json: [] }))
    await page.goto('/materias/1')

    const lista = page.getByRole('list', { name: 'Alumnos inscritos' })
    await expect(lista.getByRole('listitem')).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Dar de baja' })).toHaveCount(0)
    const cortada = await lista.evaluate((ul) => [...ul.querySelectorAll('li *')].some((el) => el.getBoundingClientRect().right > ul.getBoundingClientRect().right + 1))
    expect(cortada).toBe(false)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)

    await page.getByRole('button', { name: 'Acciones para Luis Pérez' }).click()
    await expect(page.getByRole('menuitem', { name: 'Completar datos' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Dar de baja de la materia' }).click()
    await expect(page.getByRole('dialog', { name: 'Dar de baja a Luis Pérez' })).toContainText('no se borra')
  })
}
