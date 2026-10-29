import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'
import { mockJefatura } from './jefatura-fixture'

test.use({ timezoneId: 'America/Mexico_City' })

for (const { width, dark } of [{ width: 1440, dark: false }, { width: 390, dark: true }, { width: 320, dark: false }]) {
  test(`clases compactas: ${width}px, ${dark ? 'oscuro' : 'claro'}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await mockApi(page, 'JEFE_CARRERA')
    await mockJefatura(page)
    await page.goto('/dashboard')
    if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
    const apartado = page.getByRole('region', { name: 'Clases de hoy', exact: true })
    await expect(apartado.getByRole('article')).toHaveCount(1)
    await expect(apartado.getByRole('button', { name: /Ver las otras \d+ clases/ })).toBeVisible()
    const expandir = apartado.locator('.hoy-expandir')
    await expect(expandir).toHaveAttribute('aria-expanded', 'false')
    await apartado.screenshot({ path: testInfo.outputPath('clase-destacada.png') })
    await expandir.focus()
    await page.keyboard.press('Enter')
    await expect(expandir).toHaveAttribute('aria-expanded', 'true')
    expect(await apartado.getByRole('article').count()).toBeGreaterThan(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const axe = await new AxeBuilder({ page }).include('.inicio-hoy').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([])
    await apartado.screenshot({ path: testInfo.outputPath('clases-expandidas.png') })
    await expandir.click()
    await expect(apartado.getByRole('article')).toHaveCount(1)
    const detalle = apartado.getByRole('article').getByRole('link')
    await detalle.click()
    await expect(page).toHaveURL(/\/jefe-carrera\/horarios.*clase=/)
    await expect(page.getByRole('dialog', { name: 'Detalle de clase' })).toBeVisible()
  })
}
