import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures'

const status = (orden) => (orden < 3 ? 'FINALIZADA' : orden === 3 ? 'ACTIVA' : 'PENDIENTE')
const unidades = [1, 2, 3, 4, 5].map((orden) => ({ id: orden, nombre: `Unidad ${orden}`, orden, status: status(orden) }))
const grupo = { id: 1, nombre: '103A' }
const materias = [{ id: 1, nombre: 'Matemáticas', clave: 'MAT-1', grupos: [grupo], unidades }]
const alumnos = ['AGUILAR ZARATE ANA LAURA', 'BARRERA CRUZ LUIS', 'CASTRO DÍAZ MARÍA']
const rows = alumnos.flatMap((nombre, i) => unidades.map((unidad) => ({
  alumno: { id: i + 1, nombre, numeroControl: `265Q00${80 + i}` },
  materia: { id: 1, nombre: 'Matemáticas', clave: 'MAT-1' },
  grupo, unidad,
  calificacionCalculada: unidad.orden < 3 ? 100 : null,
  fuenteCalificacion: unidad.orden < 3 ? 'CALCULADA' : 'PENDIENTE',
  estado: unidad.orden < 3 ? 'APROBADO' : 'PENDIENTE',
  tareas: { calificadas: 0, total: 1 }, asistencia: { porcentaje: 100 },
})))
const reporte = { rows, metrics: { totalAlumnos: alumnos.length, promedioGeneral: 100 } }

for (const [theme, width] of [['dark', 390], ['light', 1280]]) {
  test(`calificaciones: lista en la unidad abierta ${theme}@${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: theme })
    await mockApi(page, 'DOCENTE')
    await page.route('**/api/materias/mis-materias', (route) => route.fulfill({ json: materias }))
    await page.route('**/api/calificaciones/docente**', (route) => route.fulfill({ json: reporte }))
    await page.route('**/api/calificaciones/criterios**', (route) => route.fulfill({ json: { materiaId: 1, grupoId: null, base: null, unidades: [], catalogo: [], gruposDelDocente: [] } }))
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('/calificaciones?materia=1')

    const filtro = page.getByRole('radiogroup', { name: 'Mostrar unidad' })
    await expect(filtro).toBeVisible()
    // Arranca en la unidad abierta: cada alumno aparece una vez.
    await expect(filtro.getByRole('radio', { name: 'Unidad 3' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('Se muestra la unidad abierta (Unidad 3).', { exact: false })).toBeVisible()
    await expect(page.getByLabel(/Calificación de /)).toHaveCount(alumnos.length)
    await filtro.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `audit/docente/calificaciones-unidad-abierta-${width}-${theme}.png` })

    await filtro.getByRole('radio', { name: 'Todas' }).click()
    await expect(page).toHaveURL(/en-unidad=todas/)
    await expect(page.getByLabel(/Calificación de AGUILAR ZARATE ANA LAURA/)).toHaveCount(5)

    await filtro.getByRole('radio', { name: 'Unidad 2' }).click()
    await expect(page).toHaveURL(/en-unidad=2/)
    await expect(page.getByLabel(/Calificación de AGUILAR ZARATE ANA LAURA/)).toHaveCount(1)
    await expect(page.getByLabel(/Calificación de /)).toHaveCount(alumnos.length)
    await filtro.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `audit/docente/calificaciones-unidad-${width}-${theme}.png` })

    // La vista por alumno no usa el filtro y lo esconde.
    await page.getByRole('button', { name: 'Por alumno' }).click()
    await expect(filtro).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
