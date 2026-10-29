import { test, expect } from '@playwright/test'
import { mockApi, horario } from './fixtures'

const panel = (pendientes, listasPendientes = 0) => ({
  clasesHoy: [], claseActual: null, proximaClase: null, proximasSuspensiones: [],
  resumen: { materias: 1, clasesHoy: 2, listasPendientes },
  pendientes, materias: [],
})

test('Inicio: el día es el título y sólo aparece lo que está pendiente', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/dashboard/docente', (route) => route.fulfill({ json: panel({ alumnosEnRiesgo: 3, entregasSinCalificar: 0, solicitudes: 0 }, 1) }))
  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(Domingo|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado) \d+ de \w+$/)
  await expect(page.getByText('Tienes 2 clases hoy.')).toBeVisible()
  await expect(page.getByText(/urgente/)).toHaveCount(0)
  const atencion = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Requiere tu atención' }) })
  await expect(atencion.getByRole('link')).toHaveText(['1 lista sin pasar', '3 alumnos en riesgo'])
  await expect(page.getByText(/^0 /)).toHaveCount(0)
})

test('Inicio sin pendientes dice que estás al día', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/dashboard/docente', (route) => route.fulfill({ json: panel({ alumnosEnRiesgo: 0, entregasSinCalificar: 0, solicitudes: 0 }) }))
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Estás al día' })).toBeVisible()
})

test('el menú del docente lleva a Alumnos en riesgo y Solicitudes', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.goto('/docente/horario')
  const menu = page.getByRole('complementary', { name: 'Menú principal' })
  await menu.getByRole('link', { name: 'Alumnos en riesgo' }).click()
  await expect(page).toHaveURL(/\/docente\/riesgo$/)
  await menu.getByRole('link', { name: 'Solicitudes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Solicitudes de inscripción' })).toBeVisible()
})

test('una clase del horario abre su materia', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.goto('/docente/horario')
  await page.getByRole('button', { name: /Matemáticas/ }).first().click()
  await expect(page.getByRole('link', { name: 'Abrir la materia' })).toHaveAttribute('href', `/materias/1?grupo=${horario.grupo.id}`)
})

test('aceptar todas las solicitudes pide confirmación y deja las que fallan', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/inscripciones/pendientes', (route) => route.fulfill({ json: [1, 2, 3].map((id) => ({
    id, alumno: { nombre: `Alumno ${id}` }, materia: { nombre: 'Matemáticas' }, periodo: '2026-B', createdAt: '2026-10-05T10:00:00Z',
  })) }))
  const aceptadas = []
  await page.route('**/api/inscripciones/*/aceptar', (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-2))
    if (id === 2) return route.fulfill({ status: 409, json: { message: 'Grupo lleno' } })
    aceptadas.push(id)
    return route.fulfill({ json: { ok: true } })
  })
  await page.goto('/docente/solicitudes')
  await expect(page.getByText('3 alumnos esperan respuesta.')).toBeVisible()
  await page.getByRole('button', { name: 'Aceptar todas' }).click()
  await page.getByRole('dialog', { name: 'Aceptar 3 solicitudes' }).getByRole('button', { name: 'Aceptar todas' }).click()
  await expect(page.getByText('No se pudo aceptar 1 solicitud. Sigue en la lista; intenta de nuevo.')).toBeVisible()
  expect(aceptadas).toEqual([1, 3])
  await expect(page.getByText('Alumno 2')).toBeVisible()
  await expect(page.getByText('Alumno 1')).toHaveCount(0)
})
