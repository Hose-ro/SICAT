import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures'

const pad = (n) => String(n).padStart(2, '0')
const enDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

const choque = (horarioId, materia, horaInicio, horaFin, extra = {}) => ({
  horarioId, materia: { id: horarioId, nombre: materia, clave: `M${horarioId}` }, grupo: { id: 1, nombre: '806A' },
  horaInicio, horaFin, justificacion: null, sinClases: null, listaCapturada: false, ...extra,
})

const reunion = (choques) => ({
  id: 5, carrera: { id: 1, nombre: 'Ingeniería en Sistemas', codigo: 'ISC' }, creadaPor: { id: 9, nombre: 'Jefatura' },
  titulo: 'Reunión ordinaria de academia', asunto: 'Avance programático', tipo: 'ORDINARIA', numeroActa: null,
  fecha: enDias(6), horaInicio: '12:30', horaFin: '13:30', modalidad: 'PRESENCIAL', lugar: 'Sala de juntas', enlace: null,
  estado: 'PROGRAMADA', observaciones: null, puntos: [], acuerdos: [], asistencia: { convocados: 4, asistieron: 0, registrada: false },
  totalConvocados: 4, miAsistencia: null, choques,
})

test('el docente justifica la clase que choca con la reunión de academia', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  let choques = [
    choque(36, 'Programación Móvil', '12:00', '13:00'),
    choque(32, 'Programación Lógica y Funcional', '13:00', '14:00', { listaCapturada: true }),
  ]
  let enviado
  await page.route('**/api/reuniones/mias', (route) => route.fulfill({ json: [reunion(choques)] }))
  await page.route('**/api/reuniones/5/justificaciones**', async (route) => {
    if (route.request().method() === 'POST') {
      enviado = route.request().postDataJSON()
      choques = choques.map((c) => (enviado.horarioIds.includes(c.horarioId) ? { ...c, justificacion: { motivo: enviado.motivo, reunionId: 5, creadaEn: new Date().toISOString() } } : c))
    } else {
      choques = choques.map((c) => (c.horarioId === 36 ? { ...c, justificacion: null } : c))
    }
    return route.fulfill({ json: choques })
  })

  await page.goto('/docente/reuniones')
  await expect(page.getByText('Se cruza con 2 de tus clases')).toBeVisible()
  await expect(page.getByText('Ya pasaste lista')).toBeVisible()
  await expect(page.getByLabel('Por qué no darás la clase')).toHaveValue('Reunión de academia: Reunión ordinaria de academia')
  await page.screenshot({ path: 'audit/docente-reunion-choque.png', fullPage: true })

  await page.getByRole('button', { name: 'Justificar clase' }).click()
  expect(enviado).toEqual({ horarioIds: [36], motivo: 'Reunión de academia: Reunión ordinaria de academia' })
  await expect(page.getByText('Justificada', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Por qué no darás la clase')).toBeHidden()
  await page.screenshot({ path: 'audit/docente-reunion-justificada.png', fullPage: true })

  await page.getByRole('button', { name: 'Quitar la justificación de Programación Móvil · 806A' }).click()
  await expect(page.getByText('Sin justificar')).toBeVisible()
})

test('el Inicio del docente muestra las reuniones de academia bajo las clases de hoy', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/reuniones/mias', (route) => route.fulfill({ json: [
    reunion([choque(36, 'Programación Móvil', '12:00', '13:00')]),
    { ...reunion([]), id: 6, titulo: 'Revisión de instrumentación', fecha: enDias(13), horaInicio: '10:00', horaFin: '11:00', modalidad: 'VIRTUAL', lugar: null },
  ] }))
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/dashboard')

  const panel = page.locator('article', { has: page.getByRole('heading', { name: 'Reuniones de academia' }) })
  await expect(panel.getByRole('heading', { name: 'Reunión ordinaria de academia' })).toBeVisible()
  await expect(panel.getByText('Próxima reunión')).toBeVisible()
  await expect(panel.getByText('Se cruza con tu clase · justifícala')).toBeVisible()
  await expect(panel.getByText('Revisión de instrumentación')).toBeVisible()
  await expect(panel.getByRole('link', { name: 'Ver reunión' })).toHaveAttribute('href', '/docente/reuniones?reunion=5')
  const clases = await page.getByRole('heading', { name: 'Clases de hoy' }).boundingBox()
  const reuniones = await panel.boundingBox()
  expect(reuniones.y).toBeGreaterThan(clases.y)
  await page.screenshot({ path: 'audit/docente/inicio-reuniones-1280-light.png', fullPage: true })

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(panel.getByRole('heading', { name: 'Reunión ordinaria de academia' })).toBeVisible()
  await page.screenshot({ path: 'audit/docente/inicio-reuniones-390-dark.png', fullPage: true })
})
