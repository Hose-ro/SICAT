import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'
import { mockJefatura } from './jefatura-fixture'

test.use({ timezoneId: 'America/Mexico_City' })
for (const width of [1440, 390]) {
  test(`alias opcional y encabezado del docente a ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    let alias = null
    const cambios = []
    const perfil = { id: 37, nombre: 'Laura Méndez', rol: 'DOCENTE', email: 'laura@example.com', telefono: '+524421234567' }
    let rol = 'DOCENTE'
    await mockApi(page, 'DOCENTE')
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: { id: rol === 'DOCENTE' ? 37 : 1, nombre: 'Persona de prueba', rol, activo: true } }))
    await page.route('**/api/usuarios/perfil', (route) => {
      if (route.request().method() === 'PATCH') {
        const data = route.request().postDataJSON(); cambios.push(data); alias = data.alias
      }
      return route.fulfill({ json: { ...perfil, alias } })
    })
    await page.goto('/perfil')
    const field = page.getByLabel('Alias (opcional)')
    await expect(field).toBeVisible()
    await expect(page.getByLabel('Teléfono')).toHaveValue('4421234567')
    await field.fill('Profe Laura')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Guardaste tus datos.')).toBeVisible()
    expect(cambios).toEqual([{ alias: 'Profe Laura' }])
    await page.reload()
    await expect(page.getByLabel('Alias (opcional)')).toHaveValue('Profe Laura')

    rol = 'JEFE_CARRERA'
    await mockJefatura(page, { ajustarResumen: (r) => ({ ...r, docentes: r.docentes.map((d) => ({ ...d, alias: d.id === 37 ? alias : null })) }) })
    await page.goto('/jefe-carrera/docentes/37')
    if (width === 390) await page.evaluate(() => document.documentElement.classList.add('dark'))
    const header = page.locator('.docente-perfil')
    await expect(header.getByRole('heading', { level: 1, name: 'Laura Méndez' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(header.getByText('Profe Laura', { exact: true })).toBeVisible()
    await expect(header.getByText('Perfil docente')).toHaveCount(0)
    await expect(header.getByRole('link', { name: /Ver reporte parcial/ })).toHaveAttribute('href', /docenteId=37/)
    const axe = await new AxeBuilder({ page }).include('.docente-perfil').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.map((v) => v.id)).toEqual([])
    expect(await header.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    await header.screenshot({ path: testInfo.outputPath('perfil-con-alias.png') })
    await header.getByRole('button', { name: 'Registrar observación' }).click()
    await expect(page.getByRole('dialog', { name: 'Observación con Laura Méndez' })).toBeVisible()
    await page.keyboard.press('Escape')

    rol = 'DOCENTE'
    await page.goto('/perfil')
    await page.getByLabel('Alias (opcional)').fill('')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Guardaste tus datos.')).toBeVisible()
    expect(cambios.at(-1)).toEqual({ alias: null })
    rol = 'JEFE_CARRERA'
    await page.goto('/jefe-carrera/docentes/37')
    await expect(page.locator('.docente-perfil h1')).toHaveText('Laura Méndez')
    await expect(page.locator('.docente-perfil-alias')).toHaveCount(0)
    await expect(page.getByText('Perfil docente', { exact: true })).toHaveCount(0)
  })
}
