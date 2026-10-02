import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures'

const fila = (id, nombre, extra = {}) => ({
  alumno: { id, nombre, numeroControl: `22${id}` },
  materia: { id: 1, nombre: 'Matemáticas' }, grupo: { id: 1, nombre: '101A' },
  registros: 8, faltas: 3, retardos: 1, porcentajeAusencias: 50,
  tendencia: ['FALTA', 'ASISTENCIA', 'RETARDO', 'FALTA'],
  tareasVencidas: 4, tareasSinEntregar: 2, ultimoAviso: null, ...extra,
})

test('el docente le manda un aviso a un alumno en riesgo y queda registrado', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/dashboard/docente/riesgo**', (route) => route.fulfill({ json: {
    criterio: { minRegistros: 3, porcentaje: 30 },
    alumnos: [
      fila(1, 'Ana Prueba López'),
      fila(3, 'Luis Prueba', { porcentajeAusencias: 38, ultimoAviso: { id: 9, titulo: 'x', createdAt: '2026-09-20T15:00:00Z' } }),
    ],
  } }))
  let enviado
  await page.route('**/api/avisos', (route) => {
    enviado = route.request().postDataJSON()
    return route.fulfill({ json: { id: 10, titulo: enviado.titulo, createdAt: '2026-10-01T15:00:00Z', destinatarios: 1 } })
  })

  await page.goto('/docente/riesgo')
  await expect(page.getByText('Ana Prueba López')).toBeVisible()
  await expect(page.getByText('2 de 4 tareas vencidas sin entregar').first()).toBeVisible()
  await expect(page.getByText(/Avisado el 20 sep/)).toBeVisible()

  await page.getByRole('button', { name: 'Enviar aviso' }).click()
  await expect(page.getByLabel('Mensaje')).toHaveValue(/Ana, llevas 3 faltas y 1 retardo de 8 clases \(50 %\)\. Además, tienes 2 tareas vencidas sin entregar\./)
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar aviso' }).click()

  await expect(page.getByText('Le avisaste a Ana Prueba López.')).toBeVisible()
  expect(enviado).toMatchObject({ materiaId: 1, grupoId: 1, alumnoId: 1, titulo: 'Tu asistencia en Matemáticas' })
  await expect(page.getByText('Avisado el 1 oct')).toBeVisible()
})
