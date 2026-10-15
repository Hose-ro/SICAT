import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'

test.describe('barra inferior en el teléfono', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('Pasar lista abre la clase en curso, Más abre el menú y nada queda debajo de la barra', async ({ page }) => {
    await mockApi(page, 'DOCENTE')
    await page.goto('/dashboard')
    const barra = page.getByRole('navigation', { name: 'Accesos del docente' })
    await expect(barra.getByRole('link')).toHaveText(['Inicio', 'Pasar lista', 'Tareas'])
    await expect(barra.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')

    await barra.getByRole('link', { name: 'Pasar lista' }).click()
    await expect(page).toHaveURL(/\/docente\/pasar-lista\/10$/)
    await expect(barra.getByRole('link', { name: 'Pasar lista' })).toHaveAttribute('aria-current', 'page')
    // La barra de guardar queda encima de la de navegación, no tapada.
    const guardar = await page.getByRole('button', { name: 'Guardar asistencia' }).boundingBox()
    const nav = await barra.boundingBox()
    expect(guardar.y + guardar.height).toBeLessThanOrEqual(nav.y)

    await barra.getByRole('button', { name: 'Más' }).click()
    await expect(page.getByRole('dialog', { name: 'Menú principal' })).toBeVisible()
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.map((v) => v.id)).toEqual([])
  })

  test('sin clase iniciada, Pasar lista lleva a Asistencias', async ({ page }) => {
    await mockApi(page, 'DOCENTE')
    await page.route('**/api/clases/docente/panel', (route) => route.fulfill({ json: { clasesHoy: [], claseActual: null } }))
    await page.goto('/docente/pasar-lista')
    await expect(page).toHaveURL(/\/asistencias$/)
  })

  test('el alumno no ve la barra del docente', async ({ page }) => {
    await mockApi(page, 'ALUMNO')
    await page.goto('/alumno/horario')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Accesos del docente' })).toHaveCount(0)
  })
})

test('en escritorio no aparece la barra inferior', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockApi(page, 'DOCENTE')
  await page.goto('/dashboard')
  await expect(page.getByRole('navigation', { name: 'Accesos del docente' })).toBeHidden()
})

const perfil = {
  id: 2, nombre: 'Docente de prueba', email: 'docente@escuela.edu.mx', numeroControl: null, username: 'dprueba', rol: 'DOCENTE',
  telefono: '6141234567', academias: [{ id: 1, nombre: 'Sistemas y Computación' }], carrerasJefe: [],
}

async function abrirPerfil(page) {
  await mockApi(page, 'DOCENTE')
  const cambios = []
  await page.route('**/api/usuarios/perfil', (route) => {
    if (route.request().method() === 'PATCH') {
      const datos = route.request().postDataJSON()
      cambios.push(datos)
      return route.fulfill({ json: { ...perfil, ...datos } })
    }
    return route.fulfill({ json: perfil })
  })
  await page.goto('/dashboard')
  await page.getByRole('link', { name: /^Mi perfil:/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible()
  return cambios
}

test('Mi perfil: se llega desde el nombre, valida y guarda sólo lo que cambió', async ({ page }) => {
  const cambios = await abrirPerfil(page)
  await expect(page.getByText('Docente · dprueba')).toBeVisible()
  await expect(page.getByText('Sistemas y Computación')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()

  await page.getByLabel('Teléfono').fill('614 123')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('El teléfono lleva 10 dígitos, sin espacios.')).toBeVisible()
  await expect(page.getByLabel('Teléfono')).toHaveAttribute('aria-invalid', 'true')
  expect(cambios).toHaveLength(0)

  await page.getByLabel('Teléfono').fill('6149876543')
  await page.getByLabel('Nombre completo').fill('Docente Renombrada')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Guardaste tus datos.')).toBeVisible()
  expect(cambios).toEqual([{ nombre: 'Docente Renombrada', telefono: '6149876543' }])
  await expect(page.locator('.user__name')).toHaveText('Docente Renombrada')

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(axe.violations.map((v) => v.id)).toEqual([])
})

test('Mi perfil: cambiar el correo avisa que se cerrará la sesión', async ({ page }) => {
  const cambios = await abrirPerfil(page)
  await page.getByLabel('Correo').fill('nuevo@escuela.edu.mx')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Cambiar tu correo' })
  await expect(dialogo).toContainText('se cerrará tu sesión')
  await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  expect(cambios).toHaveLength(0)

  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await dialogo.getByRole('button', { name: 'Cambiar correo' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(cambios).toEqual([{ email: 'nuevo@escuela.edu.mx' }])
})

test('el cambio de contraseña sigue funcionando desde el menú', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  const enviados = []
  await page.route('**/api/auth/change-password', (route) => {
    enviados.push(route.request().postDataJSON())
    return route.fulfill({ json: { ok: true } })
  })
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Cambiar contraseña' })
  await expect(dialogo.getByLabel('Contraseña actual')).toBeFocused()
  await dialogo.getByLabel('Contraseña actual').fill('Actual-2026')
  await dialogo.getByLabel('Nueva contraseña', { exact: true }).fill('Nueva-2026!')
  await dialogo.getByLabel('Confirmar nueva contraseña').fill('Otra-2026!!')
  await dialogo.getByRole('button', { name: 'Actualizar contraseña' }).click()
  await expect(dialogo.getByRole('alert')).toHaveText('Las contraseñas no coinciden')
  expect(enviados).toHaveLength(0)
  await dialogo.getByLabel('Nueva contraseña', { exact: true }).fill('Nueva-2026!')
  await dialogo.getByLabel('Confirmar nueva contraseña').fill('Nueva-2026!')
  await dialogo.getByRole('button', { name: 'Actualizar contraseña' }).click()
  await expect(dialogo.getByRole('status')).toHaveText('¡Contraseña actualizada!')
  expect(enviados).toEqual([{ currentPassword: 'Actual-2026', newPassword: 'Nueva-2026!' }])
  await expect(dialogo).toBeHidden({ timeout: 4000 })
})
