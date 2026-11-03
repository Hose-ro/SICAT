import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi, materia, grupo } from './fixtures'

const unidades = [{ id: 1, nombre: 'Unidad 1', orden: 1 }, { id: 2, nombre: 'Unidad 2', orden: 2 }]
const sesiones = [
  { id: 10, fecha: '2026-09-10T08:00:00', semanaClave: '2026-09-07', grupoId: 1, unidadId: 1 },
  { id: 12, fecha: '2026-09-10T12:00:00', semanaClave: '2026-09-07', grupoId: 1, unidadId: 1 },
]

// Responde como el backend con orden=grupo: cada paso depende del anterior.
async function mockCalendario(page) {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/asistencias/filtros-disponibles**', (route) => {
    const params = new URL(route.request().url()).searchParams
    if (params.get('orden') !== 'grupo') {
      return route.fulfill({ json: { materias: [materia], grupos: [grupo], unidades: [], fechasClase: [], mesesClase: [] } })
    }
    const unidadId = params.get('unidadId')
    const fechasClase = unidadId === '1' ? ['2026-09-10', '2026-09-14'] : []
    return route.fulfill({ json: {
      grupos: [grupo],
      materias: params.get('grupoId') ? [materia] : [],
      unidades: params.get('materiaId') ? unidades : [],
      fechasClase,
      mesesClase: fechasClase.length ? ['2026-09'] : [],
      diasClase: unidadId === '1' ? [{ fecha: '2026-09-10', sesiones: 2 }, { fecha: '2026-09-14', sesiones: 1 }] : [],
    } })
  })
  await page.route('**/api/asistencias/reporte/1**', (route) => route.fulfill({ json: {
    materia: { ...materia, docente: { id: 2, nombre: 'Docente de prueba' } },
    filtros: {},
    sesiones,
    alumnos: [{ id: 1, nombre: 'Ana Prueba', numeroControl: '225Q0103' }],
    asistencias: [{ alumnoId: 1, claseSesionId: 10, estado: 'ASISTENCIA' }, { alumnoId: 1, claseSesionId: 12, estado: 'RETARDO' }],
  } }))
}

for (const vista of [{ ancho: 1280, alto: 900 }, { ancho: 390, alto: 844 }]) {
  test(`reporte por día: grupo → materia → unidad → día abre la vista previa (${vista.ancho}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vista.ancho, height: vista.alto })
    await mockCalendario(page)
    await page.goto('/asistencias')
    const card = page.getByRole('region', { name: 'Reporte por día' })
    await expect(card.getByLabel('Materia')).toBeDisabled()

    await card.getByLabel('Grupo').selectOption('1')
    await card.getByLabel('Materia').selectOption('1')
    await card.getByLabel('Unidad').selectOption('1')
    const dia = card.getByRole('button', { name: /10 de septiembre de 2026: ver reporte de 2 sesiones/ })
    await expect(dia).toBeEnabled()
    await expect(card.getByRole('button', { name: /11 de septiembre de 2026: sin sesiones/ })).toBeDisabled()
    await card.scrollIntoViewIfNeeded()
    const sinDesborde = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(sinDesborde).toBe(true)
    const violations = (await new AxeBuilder({ page }).include('section[aria-labelledby]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations
    expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html) }))).toEqual([])
    await card.screenshot({ path: `audit/docente/asistencias-reporte-calendario-${vista.ancho}.png` })

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/asistencias/reporte/1')),
      dia.click(),
    ])
    const params = new URL(request.url()).searchParams
    expect(params.get('grupoId')).toBe('1')
    expect(params.get('unidadId')).toBe('1')
    expect(params.get('fecha')).toBe('2026-09-10')
    const dialog = page.getByRole('dialog', { name: 'Vista previa del reporte' })
    await expect(dialog).toContainText('101A · Matemáticas · Unidad 1 · 10 de septiembre de 2026')
  })
}

test('reporte por día: una unidad sin sesiones lo dice en lugar de mostrar un calendario vacío', async ({ page }) => {
  await mockCalendario(page)
  await page.goto('/asistencias')
  const card = page.getByRole('region', { name: 'Reporte por día' })
  await card.getByLabel('Grupo').selectOption('1')
  await card.getByLabel('Materia').selectOption('1')
  await card.getByLabel('Unidad').selectOption('2')
  await expect(card).toContainText('No hay sesiones registradas para esta unidad y grupo')
  await expect(card.getByRole('button', { name: /ver reporte de/ })).toHaveCount(0)
})

test('reporte por día: abrir un día no deja el historial filtrado a esa fecha', async ({ page }) => {
  await mockCalendario(page)
  const historiales = []
  page.on('request', (req) => { if (req.url().includes('/asistencias/historial')) historiales.push(new URL(req.url()).search) })
  await page.goto('/asistencias')
  const card = page.getByRole('region', { name: 'Reporte por día' })
  await card.getByLabel('Grupo').selectOption('1')
  await card.getByLabel('Materia').selectOption('1')
  await card.getByLabel('Unidad').selectOption('1')
  await card.getByRole('button', { name: /10 de septiembre de 2026: ver reporte/ }).click()
  await expect(page.getByRole('dialog', { name: 'Vista previa del reporte' })).toBeVisible()
  expect(historiales.some((query) => query.includes('fecha='))).toBe(false)
  await expect(page.getByText('Mostrando sólo:')).toHaveCount(0)
})

test('historial: al llegar desde una materia avisa del filtro y permite ver todo', async ({ page }) => {
  await mockCalendario(page)
  await page.goto('/asistencias?materia=1&grupo=1')
  await expect(page.getByText('Mostrando sólo:')).toContainText('Matemáticas')
  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().includes('/asistencias/historial') && !new URL(req.url()).search),
    page.getByRole('button', { name: 'Ver todo el historial' }).click(),
  ])
  expect(new URL(request.url()).search).toBe('')
  await expect(page).toHaveURL(/\/asistencias$/)
  await expect(page.getByText('Mostrando sólo:')).toHaveCount(0)
})
