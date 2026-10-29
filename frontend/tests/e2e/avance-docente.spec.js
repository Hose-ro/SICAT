import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'
import { mockJefatura } from './jefatura-fixture'

test.use({ timezoneId: 'America/Mexico_City' })
for (const width of [1440, 390, 320]) {
  test(`avance desplegable y unidades a ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await mockApi(page, 'JEFE_CARRERA')
    await mockJefatura(page, { ajustarResumen: (r) => ({ ...r, ofertas: r.ofertas.map((o, i) => i ? o : ({ ...o,
      unidades: [1, 2, 3, 4, 5].map((n) => ({ id: n, orden: n, nombre: `Unidad ${n}`, status: n < 3 ? 'FINALIZADA' : n === 3 ? 'ACTIVA' : 'PENDIENTE', fechaInicio: null, fechaFin: null })),
      resumen: { ...o.resumen, calificacionesPendientes: 5, entregasPendientes: 0, sinEntrega: 16 },
    })) }) })
    await page.goto('/jefe-carrera/docentes/37')
    if (width === 390) await page.evaluate(() => document.documentElement.classList.add('dark'))
    await expect(page.getByRole('heading', { name: 'Registro de listas de asistencia', exact: true })).toBeVisible()
    await expect(page.getByText(/Registro de listas =/)).toHaveCount(0)
    const avance = page.getByRole('region', { name: 'Calificaciones, actividades y unidades', exact: true })
    const courses = avance.locator('.avance-materia')
    const first = courses.first()
    await expect(first.locator('.avance-contenido')).toBeVisible()
    await expect(courses.nth(1).locator('.avance-contenido')).toBeHidden()
    await expect(first.getByRole('button', { name: /^Unidad/ })).toHaveCount(5)
    await first.getByRole('button', { name: 'Unidad 4, Pendiente' }).click()
    await expect(first.getByRole('status')).toContainText('Unidad 4 · Pendiente · Sin plazo definido')
    const toggle = first.locator('.avance-expandir')
    await toggle.focus(); await page.keyboard.press('Enter')
    await expect(first.locator('.avance-contenido')).toBeHidden()
    await expect(first.locator('.avance-resumen-pendientes')).toContainText('5 calificaciones por capturar')
    await toggle.press('Enter')
    await expect(first.getByRole('button', { name: 'Unidad 4, Pendiente' })).toHaveAttribute('aria-pressed', 'true')
    await expect(avance.getByText('Avance y pendientes por materia y grupo.', { exact: true })).toHaveCount(0)
    await expect(avance.getByText('Ejemplo con los datos de la captura. “Sin entrega” corresponde al alumnado.', { exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const axe = await new AxeBuilder({ page }).include('.avance-docente').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([])
    await avance.screenshot({ path: testInfo.outputPath('avance-materias.png') })
    const link = first.getByRole('link', { name: 'Revisar pendientes' })
    await expect(link).toHaveAttribute('href', /oferta=8.*tab=unidades/)
    await link.click()
    await expect(page).toHaveURL(/\/jefe-carrera\/materias\/411.*oferta=8.*tab=unidades/)
  })
}
