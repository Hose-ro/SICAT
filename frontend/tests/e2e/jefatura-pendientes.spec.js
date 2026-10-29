import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'
import { mockJefatura } from './jefatura-fixture'

// Recorridos de la implementación del 28 de octubre (F01–F14). La evidencia
// se guarda aparte para no sobrescribir la auditoría histórica.
const EVIDENCIA = '../docs/auditorias/jefatura-2026-10-28/implementacion-fases'
const axe = async (page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`)
}
const sinDesborde = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

test.describe('jefatura: pendientes y seguimiento', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, 'JEFE_CARRERA')
  })

  test('pendiente sin observación: visible, con evidencia y retorno al mismo conjunto', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await mockJefatura(page)
    await page.goto('/jefe-carrera/seguimientos')
    await expect(page.getByRole('heading', { level: 1, name: 'Pendientes y seguimiento' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Por atender' })).toHaveAttribute('aria-current', 'page')
    // Hay pendientes aunque no exista ninguna observación: se dice que no están documentados.
    await expect(page.getByText('Sin observación registrada').first()).toBeVisible()
    await expect(page.getByText(/Una observación documenta el seguimiento, pero no quita el pendiente/)).toBeVisible()
    await page.screenshot({ path: `${EVIDENCIA}/bandeja-escritorio-claro.png`, fullPage: true })
    expect(await axe(page)).toEqual([])

    // Filtro por docente y tipo: viven en la URL.
    await page.getByLabel('Docente').selectOption({ label: 'Carlos Ruiz' })
    await page.getByRole('navigation', { name: 'Tipo de pendiente' }).getByRole('link', { name: /^Calificaciones/ }).click()
    await expect(page).toHaveURL(/docente=38/)
    await expect(page).toHaveURL(/tipo=CALIFICACIONES_PENDIENTES/)
    const fila = page.locator('main li').filter({ hasText: '12 calificaciones de unidades cerradas sin capturar' })
    await expect(fila).toHaveCount(1)

    // Evidencia: abre la materia en su grupo directamente en unidades.
    await fila.getByRole('link', { name: 'Ver unidades' }).click()
    await expect(page).toHaveURL(/\/jefe-carrera\/materias\/414\?.*oferta=9.*tab=unidades/)
    await expect(page.getByRole('link', { name: 'Unidades y calificaciones' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('region', { name: 'Calificaciones de Programación orientada a objetos, grupo 3A, por unidad' })).toBeVisible()
    await page.screenshot({ path: `${EVIDENCIA}/materia-unidades-escritorio.png`, fullPage: true })
    expect(await axe(page)).toEqual([])

    // Volver regresa al conjunto filtrado; la ubicación jerárquica sigue disponible.
    await expect(page.getByRole('navigation', { name: 'Regresar' }).getByRole('link', { name: 'Materias' })).toBeVisible()
    await page.getByRole('link', { name: 'Volver a Pendientes y seguimiento' }).click()
    await expect(page).toHaveURL(/\/jefe-carrera\/seguimientos\?.*docente=38.*tipo=CALIFICACIONES_PENDIENTES|tipo=CALIFICACIONES_PENDIENTES.*docente=38/)
    await expect(page.getByLabel('Docente')).toHaveValue('38')
  })

  test('registrar y cerrar una observación no hace desaparecer la lista pendiente', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await mockJefatura(page)
    await page.goto('/jefe-carrera/seguimientos?seccion=pendientes&tipo=ASISTENCIA_SIN_CAPTURA')
    const filas = page.locator('main li').filter({ has: page.getByRole('link', { name: 'Ver clase' }) })
    await expect(filas.first()).toBeVisible()
    const total = await filas.count()
    expect(total).toBeGreaterThan(0)
    const primera = filas.first()
    await primera.getByRole('button', { name: 'Registrar observación' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Nota').fill('El docente capturará la lista mañana.')
    await dialog.getByRole('button', { name: 'Guardar nota' }).click()
    await expect(dialog.getByText('Nota guardada en el historial.')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(primera.getByText(/Observación abierta/)).toBeVisible()
    await expect(filas).toHaveCount(total)

    await primera.getByRole('button', { name: 'Agregar nota' }).click()
    await dialog.getByLabel('Nueva nota').fill('Se cierra el acuerdo; la lista sigue sin capturar.')
    await dialog.getByRole('button', { name: 'Cerrar caso' }).click()
    await dialog.getByRole('button', { name: 'Guardar y cerrar' }).click()
    await expect(dialog).toBeHidden()
    // El seguimiento queda cerrado, pero el pendiente académico continúa.
    await expect(primera.getByText(/Cerrado el/)).toBeVisible()
    await expect(filas).toHaveCount(total)
    await page.screenshot({ path: `${EVIDENCIA}/bandeja-observacion-cerrada.png`, fullPage: true })

    // Observaciones registradas muestra el caso cerrado y que la causa sigue.
    await page.getByRole('link', { name: 'Observaciones registradas' }).click()
    await page.getByRole('link', { name: /^Cerrados/ }).click()
    await expect(page.getByText('La lista sigue sin captura completa')).toBeVisible()
  })

  test('enlaces anteriores de observaciones y fallo de una sola fuente', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await mockJefatura(page)
    await page.goto('/jefe-carrera/seguimientos?vista=hoy')
    await expect(page.getByRole('link', { name: 'Observaciones registradas' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('link', { name: /^Para revisar hoy/ })).toHaveAttribute('aria-current', 'page')

    // Si las observaciones fallan, los pendientes no desaparecen ni se leen como cero.
    await page.route('**/api/jefe-carrera/seguimientos**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Servicio no disponible' }) }))
    await page.goto('/jefe-carrera/seguimientos?carrera=1&periodo=2026-B')
    await expect(page.getByRole('alert').filter({ hasText: 'No se pudo consultar el seguimiento' })).toBeVisible()
    await expect(page.getByText('Observación no disponible').first()).toBeVisible()
    await expect(page.getByText('Sin observación registrada')).toHaveCount(0)
    await page.screenshot({ path: `${EVIDENCIA}/bandeja-error-observaciones.png`, fullPage: true })

    // Filtros sin resultados se distinguen de una carrera sin pendientes.
    await page.goto('/jefe-carrera/seguimientos?carrera=1&periodo=2026-B&grupo=13&tipo=CALIFICACIONES_PENDIENTES')
    await expect(page.getByText('Ningún pendiente coincide con los filtros')).toBeVisible()
    await page.getByRole('button', { name: 'Quitar filtros' }).first().click()
    await expect(page).not.toHaveURL(/grupo=13/)
  })

  test('periodo histórico: consulta sin registrar observaciones', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await mockJefatura(page)
    await page.goto('/jefe-carrera/seguimientos?carrera=1&periodo=2026-A')
    await expect(page.getByText('Periodo anterior · consulta')).toBeVisible()
    await expect(page.getByText(/Periodo anterior: las observaciones solo se consultan/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Registrar observación' })).toHaveCount(0)
    await page.goto('/jefe-carrera/materias/414?carrera=1&periodo=2026-A')
    await expect(page.getByRole('button', { name: 'Incorporar alumno' })).toHaveCount(0)
  })

  test('docente → materia → volver al docente; materia con varios grupos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await mockJefatura(page)
    await page.goto('/jefe-carrera/docentes/37?carrera=1&periodo=2026-B')
    await page.getByRole('region', { name: 'Carga académica' }).getByRole('link', { name: 'Cálculo diferencial' }).first().click()
    await expect(page).toHaveURL(/\/jefe-carrera\/materias\/411\?.*desde=/)
    const grupos = page.getByRole('navigation', { name: 'Grupo de la materia' })
    await expect(grupos.getByRole('link')).toHaveCount(2)
    await expect(grupos.getByRole('link', { name: /1A/ })).toHaveAttribute('aria-current', 'true')
    await grupos.getByRole('link', { name: /1M/ }).click()
    await expect(page).toHaveURL(/oferta=13/)
    await expect(page.getByRole('heading', { level: 2, name: /Grupo 1M/ })).toBeVisible()
    await page.getByRole('link', { name: /^Alumnos/ }).click()
    await expect(page).toHaveURL(/tab=alumnos/)
    await page.screenshot({ path: `${EVIDENCIA}/materia-detalle-grupos.png`, fullPage: true })
    await page.getByRole('link', { name: 'Volver al docente' }).click()
    await expect(page).toHaveURL(/\/jefe-carrera\/docentes\/37\?/)
    await expect(page.getByRole('heading', { level: 1, name: 'Laura Méndez' })).toBeVisible()
  })

  test('alumno incorporado desde otro grupo: búsqueda y expediente con grupo base', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await mockJefatura(page)
    await page.goto('/jefe-carrera/grupos')
    await expect(page.getByRole('heading', { level: 1, name: 'Grupos y alumnos' })).toBeVisible()
    await page.getByLabel('Nombre o número de control del alumno').fill('Bruno')
    await expect(page).toHaveURL(/alumno=Bruno/)
    await expect(page.getByRole('link', { name: 'Expediente · grupo 3A' })).toBeVisible()
    await page.screenshot({ path: `${EVIDENCIA}/grupos-busqueda.png`, fullPage: true })
    expect(await axe(page)).toEqual([])
    // Acceso directo al alumnado: Zoe (grupo base 9A) aparece incorporada en 11 (7A).
    await page.getByRole('link', { name: 'Ver alumnos del grupo 7A' }).click()
    await expect(page).toHaveURL(/\/jefe-carrera\/grupos\/11\?.*tab=alumnos/)
    await expect(page.getByText('Incorporado · grupo base 9A')).toBeVisible()
    await page.getByRole('button', { name: 'Zoe Incorporada' }).click()
    await expect(page.getByRole('dialog', { name: 'Zoe Incorporada' })).toContainText('Grupo base')
  })

  test('copiar contacto: si el navegador lo impide, se avisa y queda texto seleccionable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denegado')) } })
    })
    await mockJefatura(page)
    await page.goto('/jefe-carrera/docentes/37?carrera=1&periodo=2026-B')
    await page.getByRole('button', { name: 'Copiar contacto' }).click()
    const aviso = page.getByRole('alert').filter({ hasText: 'El navegador no permitió copiar' })
    await expect(aviso).toBeVisible()
    await expect(aviso.getByRole('textbox')).toHaveValue(/laura@sicat\.test/)
    await expect(aviso.getByRole('textbox')).toBeFocused()
    await expect(page.getByText('Copiado')).toHaveCount(0)
  })

  test('móvil: Horarios muestra una clase en el primer viewport y los mapas se desplazan', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockJefatura(page)
    await page.goto('/jefe-carrera/horarios?carrera=1&periodo=2026-B')
    const agenda = page.locator('section[aria-label]').filter({ hasText: /\d{2}:\d{2}/ }).first()
    await expect(agenda).toBeVisible()
    // Filtros secundarios plegados, con la modalidad a la vista.
    await expect(page.getByLabel('Modalidad')).toBeVisible()
    await expect(page.getByLabel('Docente')).toBeHidden()
    const primeraClase = await page.locator('section[aria-label] button').first().boundingBox()
    expect(primeraClase.y).toBeLessThan(844)
    expect(await sinDesborde(page)).toBe(true)
    await page.screenshot({ path: `${EVIDENCIA}/horarios-movil-claro.png` })
    // Filtro aplicado: el resumen dice qué se consulta aunque el panel esté cerrado.
    await page.getByText('Filtros', { exact: true }).click()
    await page.getByLabel('Docente').selectOption({ label: 'Laura Méndez' })
    await page.getByText('Filtros', { exact: true }).click()
    await expect(page.locator('summary').filter({ hasText: 'Laura Méndez' })).toBeVisible()
    expect(await axe(page)).toEqual([])

    await page.goto('/jefe-carrera/docentes?carrera=1&periodo=2026-B&vista=semanas')
    const plot = page.locator('.viz-plot').first()
    await expect(plot).toBeVisible()
    const medida = await plot.evaluate((el) => {
      const antes = el.scrollLeft
      el.scrollLeft = 200
      return { touch: getComputedStyle(el).touchAction, desborda: el.scrollWidth > el.clientWidth, movio: el.scrollLeft > antes }
    })
    expect(medida).toEqual({ touch: 'pan-x pan-y', desborda: true, movio: true })
  })
})
