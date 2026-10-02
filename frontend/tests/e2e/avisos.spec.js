import { test, expect } from '@playwright/test'
import { mockApi, materia, grupo } from './fixtures'

const aviso = (id, titulo, extra = {}) => ({
  id, titulo, cuerpo: `Detalle de ${titulo}`, fijado: false, alumnoId: null,
  createdAt: '2026-10-01T15:00:00Z', docente: { id: 2, nombre: 'Docente de prueba' }, ...extra,
})

test('el docente publica un aviso para el grupo', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  const avisos = [aviso(1, 'No hay clase el miércoles 14 de octubre', { suspensionFecha: '2026-10-14', fijado: true })]
  let enviado
  await page.route('**/api/materias/1', (route) => route.fulfill({ json: { ...materia, grupos: [grupo], unidades: [] } }))
  await page.route('**/api/tareas/materia/1', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/avisos**', async (route) => {
    if (route.request().method() === 'POST') {
      enviado = route.request().postDataJSON()
      avisos.push(aviso(2, enviado.titulo))
      return route.fulfill({ json: { ...avisos.at(-1), destinatarios: 24 } })
    }
    return route.fulfill({ json: avisos })
  })

  await page.goto('/materias/1')
  await expect(page.getByText('desde el calendario')).toBeVisible()
  await page.getByLabel('Título del aviso').fill('Traigan calculadora')
  await page.getByLabel('Mensaje del aviso').fill('Para el examen del jueves')
  await page.getByRole('button', { name: 'Publicar en 101A' }).click()

  await expect(page.getByText('Se avisó a 24 alumnos de 101A.')).toBeVisible()
  expect(enviado).toEqual({ materiaId: 1, grupoId: 1, titulo: 'Traigan calculadora', cuerpo: 'Para el examen del jueves', fijado: false })
  await expect(page.getByText('Traigan calculadora', { exact: true })).toBeVisible()
})

test('el alumno ve los avisos de su grupo y los que son sólo para él', async ({ page }) => {
  await mockApi(page, 'ALUMNO')
  await page.route('**/api/avisos/mios**', (route) => route.fulfill({ json: [
    aviso(1, 'Cambio de aula', { fijado: true }),
    aviso(2, 'Llevas 4 faltas', { alumnoId: 1 }),
  ] }))
  await page.goto('/alumno/materias/1')
  await expect(page.getByRole('heading', { name: 'Avisos del docente' })).toBeVisible()
  await expect(page.getByText('Cambio de aula', { exact: true })).toBeVisible()
  await expect(page.getByText(/Sólo para ti/)).toBeVisible()
})
