import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'

const tarea = {
  id: 50, titulo: 'Examen parcial 1', instrucciones: 'Temas 1.1 a 1.4', materiaId: 1, grupoId: 1, unidadId: 1,
  estado: 'PUBLICADA', tipoEntrega: 'PRESENCIAL', tipoEvaluacion: 'DIRECTA', tieneFechaLimite: true,
  fechaLimite: '2026-10-05T14:00:00.000Z', horaLimite: '08:00',
  materia: { id: 1, nombre: 'Matemáticas' }, grupo: { id: 1, nombre: '101A' }, unidadRef: { id: 1, nombre: 'Unidad 1', orden: 1 },
  categoria: { id: 5, nombre: 'Examen', tipo: 'EXAMEN' }, archivos: [],
  totalAlumnos: 3, entregadas: 1, calificadas: 1, pendientesRevision: 0, noPresentaron: 0,
}
const alumno = (id, nombre) => ({ id, nombre, numeroControl: `22${id}` })
const entregas = [
  { id: 'sin-entrega-1', alumno: alumno(1, 'Ana Prueba López'), estadoRevision: 'PENDIENTE', esSintetica: true },
  { id: 102, alumno: alumno(2, 'Carlos Prueba Ruiz'), estadoRevision: 'CALIFICADA', calificacion: 80, calificacionTipo: 'NUMERICA', observacion: null, esSintetica: false },
  { id: 'sin-entrega-3', alumno: alumno(3, 'Luis Prueba Pérez'), estadoRevision: 'PENDIENTE', esSintetica: true },
]

test('un examen en clase se califica en lista, con "no presentó"', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/tareas/50/entregas**', (route) => route.fulfill({ json: { tarea, entregas, stats: {}, noEntregaron: [] } }))
  let enviado
  await page.route('**/api/tareas/50/calificaciones', (route) => {
    enviado = route.request().postDataJSON()
    return route.fulfill({ json: {
      tarea,
      entregas: [
        { ...entregas[0], id: 101, estadoRevision: 'CALIFICADA', calificacion: 95, esSintetica: false },
        entregas[1],
        { ...entregas[2], id: 103, estadoRevision: 'NO_ENTREGADA', calificacion: 0, esSintetica: false },
      ],
      actualizadas: 2,
    } })
  })

  await page.goto('/docente/tareas/50')
  await expect(page.getByRole('heading', { name: 'Examen parcial 1' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Captura en lista' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Calificación de Carlos Prueba Ruiz')).toHaveValue('80')

  await page.getByLabel('Calificación de Ana Prueba López').fill('95')
  await page.getByLabel('Calificación de Ana Prueba López').press('Enter')
  await expect(page.getByLabel('Calificación de Carlos Prueba Ruiz')).toBeFocused()
  await page.getByLabel('Luis Prueba Pérez no presentó').check()
  await expect(page.getByLabel('Calificación de Luis Prueba Pérez')).toBeDisabled()

  const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html.slice(0, 120)) }))).toEqual([])

  await page.getByRole('button', { name: 'Guardar calificaciones (2)' }).click()
  await expect(page.getByText('Se guardaron 2 calificaciones.')).toBeVisible()
  expect(enviado).toEqual({ calificaciones: [{ alumnoId: 1, calificacion: 95 }, { alumnoId: 3, noPresento: true }] })
  await expect(page.getByText('3 de 3')).toBeVisible()
  await expect(page.getByText('Todo guardado')).toBeVisible()
})
