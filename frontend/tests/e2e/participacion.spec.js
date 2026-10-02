import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures'

test('el docente suma y corrige participación al pasar lista', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  const puntos = { 1: 0, 3: 2 }
  await page.route('**/api/asistencias/sesion/10/participacion', (route) => {
    const { alumnoId, delta } = route.request().postDataJSON()
    puntos[alumnoId] = Math.max(0, puntos[alumnoId] + delta)
    return route.fulfill({ json: { alumnoId, puntos: puntos[alumnoId], nota: null } })
  })
  await page.route('**/api/asistencias/sesion/10', (route) => route.fulfill({ json: {
    sesion: { id: 10, activa: true, materia: { id: 1, nombre: 'Matemáticas' }, grupo: { id: 1, nombre: '101A' }, fecha: '2026-10-01', horaInicio: '2026-10-01T08:00:00', unidad: { id: 1, nombre: 'Unidad 1' } },
    alumnos: [
      { alumnoId: 1, nombre: 'Ana Prueba', numeroControl: '225Q0103', estado: null, participacion: 0 },
      { alumnoId: 3, nombre: 'Luis Prueba', numeroControl: '225Q0104', estado: null, participacion: 2 },
    ],
  } }))

  await page.goto('/docente/pasar-lista/10')
  await expect(page.getByRole('button', { name: /Sumar participación a Luis Prueba \(lleva 2\)/ })).toHaveText(/2 pts/)

  await page.getByRole('button', { name: /Sumar participación a Ana Prueba/ }).click()
  await expect(page.getByRole('button', { name: /Sumar participación a Ana Prueba/ })).toHaveText(/1 pt$/)
  await page.getByRole('button', { name: 'Quitar un punto de participación a Luis Prueba' }).click()
  await expect(page.getByRole('button', { name: /Sumar participación a Luis Prueba/ })).toHaveText(/1 pt$/)
  expect(puntos).toEqual({ 1: 1, 3: 1 })
})
