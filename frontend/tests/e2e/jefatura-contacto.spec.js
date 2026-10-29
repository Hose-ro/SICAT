import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'
import { mockJefatura } from './jefatura-fixture'

test.use({ timezoneId: 'America/Mexico_City' })
for (const width of [1440, 390]) {
  test(`fichas y contacto de docentes a ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await mockApi(page, 'JEFE_CARRERA')
    await mockJefatura(page)
    await page.goto('/dashboard')
    if (width === 390) await page.evaluate(() => document.documentElement.classList.add('dark'))
    const section = page.getByRole('region', { name: 'Pendientes por docente' })
    await expect(section.locator('.docentes-ficha')).toHaveCount(3)
    await section.getByRole('button', { name: /Ver los \d+ docentes con pendientes/ }).click()
    expect(await section.locator('.docentes-ficha').count()).toBeGreaterThan(3)
    const first = section.locator('.docentes-ficha').first()
    await first.getByRole('button', { name: 'Contacto', exact: true }).click()
    await expect(first.getByRole('link', { name: /Abrir WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/524421234567')
    await first.getByRole('button', { name: 'Ver pendientes' }).click()
    await expect(first.locator('.docentes-detalle')).toBeVisible()
    await first.getByRole('button', { name: 'Ocultar pendientes' }).click()
    await first.getByRole('button', { name: 'Registrar observación' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const axe = await new AxeBuilder({ page }).include('section[aria-labelledby="pendientes-docentes"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([])
    await section.getByRole('button', { name: 'Mostrar solo los primeros 3 docentes' }).click()
    await section.screenshot({ path: testInfo.outputPath('pendientes-docentes.png') })
  })
}

test('captura y guarda un teléfono faltante antes de abrir WhatsApp', async ({ page }) => {
  await mockApi(page, 'JEFE_CARRERA')
  await mockJefatura(page, { ajustarResumen: (r) => ({ ...r,
    pendientes: r.pendientes.map((c) => ({ ...c, docente: { ...c.docente, telefono: null } })),
    ofertas: r.ofertas.map((o) => ({ ...o, docentes: o.docentes.map((d) => ({ ...d, telefono: null })) })),
  }) })
  let peticion
  await page.route('**/api/jefe-carrera/docentes/*/telefono**', async (route) => {
    peticion = route.request()
    await route.fulfill({ json: { id: 37, telefono: '+524421234567' } })
  })
  await page.goto('/dashboard')
  const first = page.locator('.docentes-ficha').first()
  await first.getByRole('button', { name: 'Contacto', exact: true }).click()
  await expect(first.getByText('Agrega su número telefónico')).toBeVisible()
  await expect(first.getByText('+52', { exact: true })).toBeVisible()
  const field = first.getByRole('textbox')
  await field.fill('4421234567')
  await first.getByRole('button', { name: 'Guardar número' }).click()
  await expect(first.getByRole('link', { name: /Abrir WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/524421234567')
  expect(peticion.method()).toBe('PATCH')
  expect(peticion.postDataJSON()).toEqual({ telefono: '+524421234567' })
  expect(new URL(peticion.url()).searchParams.get('carreraId')).toBe('1')
})
